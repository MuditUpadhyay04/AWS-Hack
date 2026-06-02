"""
CIRCULAR AGENTIC SYSTEM

Flow:
1. Ask question (Search #1, context-aware)
2. Get answer → update partial feature vector
3. Decision tree predicts paths (with current data)
4. Search #2: find similar users for each path → see outcomes
5. Calculate confidence: are we sure about the best path?
6. If confident: return path
7. If not confident: decide which domain to ask about next (information gain)
8. Loop back to step 1

The system asks adaptive questions based on what information would most help
differentiate between competing paths.
"""

from dotenv import load_dotenv
import os

env_path = Path(__file__).parent.parent / ".env"
load_dotenv(dotenv_path=env_path)  # Load .env file

QDRANT_URL = os.getenv("QDRANT_URL")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY")

if not QDRANT_URL or not QDRANT_API_KEY:
    raise ValueError("QDRANT_URL and QDRANT_API_KEY must be set in .env file")
    
    
import json
import numpy as np
from qdrant_client import QdrantClient
from qdrant_client.models import VectorParams, Distance, PointStruct
from sentence_transformers import SentenceTransformer
from sklearn.tree import DecisionTreeClassifier
import os


client = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY)
embedding_model = SentenceTransformer('all-MiniLM-L6-v2')

# ============================================================================
# PART 1: SYNTHETIC DATA GENERATION (same as before)
# ============================================================================

def generate_synthetic_users(n_users=500):
    """Generate synthetic users with feature vectors, paths, and outcomes."""
    users = []
    paths = ["aggressive_debt_payoff", "balanced_debt_and_savings", "invest_while_paying_minimum", "income_boost_first"]
    
    for user_id in range(n_users):
        feature_vector = np.random.rand(6)
        path = np.random.choice(paths)
        
        if path == "aggressive_debt_payoff":
            outcome = min(1.0, 0.5 + feature_vector[0] * 0.3 + feature_vector[3] * 0.2 + np.random.normal(0, 0.1))
        elif path == "balanced_debt_and_savings":
            outcome = min(1.0, 0.7 + np.random.normal(0, 0.15))
        elif path == "invest_while_paying_minimum":
            outcome = min(1.0, 0.3 + feature_vector[1] * 0.4 + feature_vector[4] * 0.3 + np.random.normal(0, 0.1))
        else:
            outcome = min(1.0, 0.6 + feature_vector[2] * 0.3 + np.random.normal(0, 0.1))
        
        outcome = max(0.0, outcome)
        
        users.append({
            "user_id": user_id,
            "feature_vector": feature_vector.tolist(),
            "path_taken": path,
            "outcome_success": outcome
        })
    
    return users

# ============================================================================
# PART 2: QDRANT SETUP (same as before)
# ============================================================================

def setup_qdrant():
    """Create collections and upload synthetic data."""
    
    print("Setting up Qdrant...")
    
    try:
        client.delete_collection(collection_name="questions")
    except:
        pass
    
    client.create_collection(
        collection_name="questions",
        vectors_config=VectorParams(size=384, distance=Distance.COSINE)
    )
    
    try:
        client.delete_collection(collection_name="user_paths")
    except:
        pass
    
    client.create_collection(
        collection_name="user_paths",
        vectors_config=VectorParams(size=6, distance=Distance.COSINE)
    )
    
    print("✓ Collections created")
    
    questions_list = [
        {"id": "q_1", "text": "What is your total debt amount?", "domain": "debt"},
        {"id": "q_2", "text": "What is your monthly income?", "domain": "income"},
        {"id": "q_3", "text": "In how many years do you want to be debt-free?", "domain": "timeline"},
        {"id": "q_4", "text": "How comfortable are you with financial risk?", "domain": "risk_tolerance"},
        {"id": "q_5", "text": "How much do you have saved currently?", "domain": "savings"},
        {"id": "q_6", "text": "What is your credit score?", "domain": "credit_score"},
    ]
    
    question_points = []
    for i, q in enumerate(questions_list):
        embedding = embedding_model.encode(q["text"])
        point = PointStruct(
            id=i,
            vector=embedding,
            payload={
                "question_id": q["id"],
                "question_text": q["text"],
                "domain": q["domain"]
            }
        )
        question_points.append(point)
    
    client.upsert(collection_name="questions", points=question_points)
    print(f"✓ Uploaded {len(question_points)} questions")
    
    synthetic_users = generate_synthetic_users(n_users=500)
    
    user_points = []
    for i, user in enumerate(synthetic_users):
        feature_vector = user["feature_vector"]
        feature_vector = np.array(feature_vector) / (np.linalg.norm(feature_vector) + 1e-8)
        
        point = PointStruct(
            id=i,
            vector=feature_vector.tolist(),
            payload={
                "user_id": user["user_id"],
                "path_taken": user["path_taken"],
                "outcome_success": user["outcome_success"],
                "feature_vector": user["feature_vector"]
            }
        )
        user_points.append(point)
    
    client.upsert(collection_name="user_paths", points=user_points)
    print(f"✓ Uploaded {len(user_points)} synthetic users")

# ============================================================================
# PART 3: DECISION TREE TRAINING
# ============================================================================

def train_decision_tree(synthetic_users):
    """Train decision tree on synthetic data."""
    X = np.array([u["feature_vector"] for u in synthetic_users])
    
    path_to_int = {
        "aggressive_debt_payoff": 0,
        "balanced_debt_and_savings": 1,
        "invest_while_paying_minimum": 2,
        "income_boost_first": 3
    }
    y = np.array([path_to_int[u["path_taken"]] for u in synthetic_users])
    
    dt = DecisionTreeClassifier(max_depth=5, random_state=42)
    dt.fit(X, y)
    
    int_to_path = {v: k for k, v in path_to_int.items()}
    
    print("✓ Decision tree trained")
    return dt, int_to_path

# ============================================================================
# PART 4: CIRCULAR INTERVIEW ENGINE
# ============================================================================

class CircularInterviewEngine:
    def __init__(self, decision_tree, int_to_path):
        self.dt = decision_tree
        self.int_to_path = int_to_path
        self.domain_order = ["debt", "income", "timeline", "risk_tolerance", "savings", "credit_score"]
        self.feature_vector_partial = {}
        self.asked_domains = []
        self.iteration = 0
        self.max_iterations = 6
        self.confidence_threshold = 0.75
    
    def select_next_question(self, user_intent):
        """
        SEARCH #1: Find most relevant question for the next unanswered domain.
        Uses intent + partial feature vector as context.
        """
        
        # Build context
        context = user_intent
        for domain, scalar in self.feature_vector_partial.items():
            context += f" {domain}: {scalar:.2f}"
        
        context_embedding = embedding_model.encode(context)
        
        # Search for the best question
        results = client.search(
            collection_name="questions",
            query_vector=context_embedding,
            limit=1,
            score_threshold=0.0
        )
        
        if results:
            question_id = results[0].payload["question_id"]
            question_text = results[0].payload["question_text"]
            domain = results[0].payload["domain"]
            return question_id, question_text, domain
        
        return None, None, None
    
    def normalize_answer(self, answer_text, domain):
        """Convert answer text to 0-1 scalar."""
        answer_lower = answer_text.lower()
        
        if domain == "debt":
            try:
                amount = float(''.join(c for c in answer_text if c.isdigit()))
                return min(1.0, amount / 100000.0)
            except:
                return 0.5
        elif domain == "income":
            try:
                amount = float(''.join(c for c in answer_text if c.isdigit()))
                return min(1.0, amount / 10000.0)
            except:
                return 0.5
        elif domain == "timeline":
            try:
                years = float(''.join(c for c in answer_text if c.isdigit() or c == '.'))
                return min(1.0, years / 10.0)
            except:
                return 0.5
        elif domain == "risk_tolerance":
            if "low" in answer_lower:
                return 0.3
            elif "high" in answer_lower:
                return 0.9
            else:
                return 0.6
        elif domain == "savings":
            try:
                amount = float(''.join(c for c in answer_text if c.isdigit()))
                return min(1.0, amount / 50000.0)
            except:
                return 0.5
        elif domain == "credit_score":
            try:
                score = float(''.join(c for c in answer_text if c.isdigit()))
                return min(1.0, score / 850.0)
            except:
                return 0.5
        
        return 0.5
    
    def fill_partial_vector(self):
        """Create full feature vector, filling missing domains with 0.5 (neutral)."""
        full_vector = []
        for domain in self.domain_order:
            if domain in self.feature_vector_partial:
                full_vector.append(self.feature_vector_partial[domain])
            else:
                full_vector.append(0.5)  # Neutral value for unanswered domains
        return np.array(full_vector)
    
    def predict_paths(self):
        """
        Predict candidate paths using current (partial) feature vector.
        Returns top 3 paths.
        """
        full_vector = self.fill_partial_vector()
        
        # Get probabilities
        path_probabilities = self.dt.predict_proba([full_vector])[0]
        
        # Get top 3
        top_indices = np.argsort(path_probabilities)[-3:][::-1]
        
        candidate_paths = [self.int_to_path[idx] for idx in top_indices]
        probabilities = [path_probabilities[idx] for idx in top_indices]
        
        return candidate_paths, probabilities
    
    def validate_paths(self):
        """
        SEARCH #2: For each candidate path, find similar users and score.
        Returns dict of path -> (score, similar_users_count, outcomes).
        """
        candidate_paths, _ = self.predict_paths()
        
        full_vector = self.fill_partial_vector()
        # Normalize
        full_vector = full_vector / (np.linalg.norm(full_vector) + 1e-8)
        
        path_scores = {}
        
        for path in candidate_paths:
            # Search for similar users on this path
            results = client.search(
                collection_name="user_paths",
                query_vector=full_vector.tolist(),
                limit=15,  # Get more for better statistics
                score_threshold=0.0
            )
            
            # Filter to this path only
            matching_users = [r for r in results if r.payload["path_taken"] == path]
            
            if matching_users:
                outcomes = [r.payload["outcome_success"] for r in matching_users]
                score = np.mean(outcomes)
                n_similar = len(matching_users)
            else:
                outcomes = []
                score = 0.0
                n_similar = 0
            
            path_scores[path] = {
                "score": score,
                "n_similar": n_similar,
                "outcomes": outcomes
            }
        
        return path_scores
    
    def calculate_confidence(self, path_scores):
        """
        Calculate confidence in best path.
        High confidence = top path is clearly winning.
        Low confidence = paths are similar in score.
        """
        sorted_paths = sorted(path_scores.items(), key=lambda x: x[1]["score"], reverse=True)
        
        if len(sorted_paths) < 2:
            return 0.5
        
        best_score = sorted_paths[0][1]["score"]
        second_best_score = sorted_paths[1][1]["score"]
        
        # Confidence = how much does best path win by?
        # Normalized by the best score to avoid division issues
        if best_score > 0.1:
            confidence = (best_score - second_best_score) / (best_score + 0.1)
        else:
            confidence = 0.0
        
        return min(1.0, max(0.0, confidence))
    
    def choose_next_domain(self, path_scores):
        """
        Information gain: which unanswered domain would most help differentiate paths?
        
        Heuristic: Pick the domain where outcomes diverge most across paths.
        """
        unanswered = [d for d in self.domain_order if d not in self.asked_domains]
        
        if not unanswered:
            return None
        
        # For each unanswered domain, measure variance across paths
        domain_variance = {}
        
        for domain in unanswered:
            # Estimate: how much do users differ on this domain across different paths?
            # Proxy: just pick the domain not yet asked about
            # (In a production system, you'd compute actual variance from path outcomes)
            domain_variance[domain] = 1.0
        
        # For now, just pick the first unanswered domain
        # (A smarter heuristic would use the outcomes to decide)
        next_domain = unanswered[0]
        
        return next_domain
    
    def run_interview(self, user_intent):
        """
        Main circular loop:
        1. Predict paths
        2. Validate paths (Search #2)
        3. Check confidence
        4. If confident: return
        5. If not: pick next domain (information gain)
        6. Ask question (Search #1)
        7. Loop
        """
        
        print(f"\n{'='*60}")
        print(f"CIRCULAR AGENTIC INTERVIEW")
        print(f"{'='*60}")
        print(f"User intent: {user_intent}\n")
        
        while self.iteration < self.max_iterations:
            self.iteration += 1
            
            print(f"\n--- Iteration {self.iteration} ---")
            
            # Step 1: Predict paths with current data
            candidate_paths, probabilities = self.predict_paths()
            print(f"Predicted paths: {candidate_paths}")
            print(f"Probabilities: {[f'{p:.2f}' for p in probabilities]}")
            
            # Step 2: Validate paths (SEARCH #2)
            path_scores = self.validate_paths()
            print(f"\nPath validation (Search #2):")
            for path, data in path_scores.items():
                print(f"  {path}: score={data['score']:.2f}, n_similar={data['n_similar']}")
            
            # Step 3: Check confidence
            confidence = self.calculate_confidence(path_scores)
            print(f"\nConfidence: {confidence:.2f}")
            
            # Step 4: Decide to stop or continue
            if confidence > self.confidence_threshold:
                print(f"✓ High confidence threshold reached ({self.confidence_threshold})")
                best_path = max(path_scores.items(), key=lambda x: x[1]["score"])
                return self._finalize(best_path, path_scores)
            
            if self.iteration >= self.max_iterations:
                print(f"✓ Max iterations ({self.max_iterations}) reached")
                best_path = max(path_scores.items(), key=lambda x: x[1]["score"])
                return self._finalize(best_path, path_scores)
            
            # Step 5: Choose next domain (information gain)
            next_domain = self.choose_next_domain(path_scores)
            
            if not next_domain:
                print("No more domains to ask about")
                best_path = max(path_scores.items(), key=lambda x: x[1]["score"])
                return self._finalize(best_path, path_scores)
            
            print(f"\nNeed more info about: {next_domain}")
            print(f"Asked so far: {self.asked_domains}")
            
            # Step 6: Ask question (SEARCH #1)
            question_id, question_text, domain = self.select_next_question(user_intent)
            
            if not question_text:
                print("Could not find question")
                break
            
            print(f"\nQ{self.iteration}: {question_text}")
            answer_text = input("> ")
            
            # Step 7: Update feature vector
            scalar_value = self.normalize_answer(answer_text, domain)
            self.feature_vector_partial[domain] = scalar_value
            self.asked_domains.append(domain)
            
            print(f"Normalized to {scalar_value:.2f}")
        
        # If we exit loop, return best path
        candidate_paths, _ = self.predict_paths()
        path_scores = self.validate_paths()
        best_path = max(path_scores.items(), key=lambda x: x[1]["score"])
        return self._finalize(best_path, path_scores)
    
    def _finalize(self, best_path, all_scores):
        """Print final results."""
        path_name, path_data = best_path
        
        print(f"\n{'='*60}")
        print(f"FINAL RECOMMENDATION")
        print(f"{'='*60}")
        print(f"Path: {path_name}")
        print(f"Score: {path_data['score']:.2f}")
        print(f"Based on: {path_data['n_similar']} similar users")
        print(f"Their outcomes: {[f'{o:.2f}' for o in path_data['outcomes'][:5]]}...")
        print(f"Questions asked: {self.iteration}")
        print(f"Domains covered: {self.asked_domains}")
        
        return path_name, all_scores

# ============================================================================
# PART 5: MAIN EXECUTION
# ============================================================================

if __name__ == "__main__":
    
    print("Setting up system...")
    setup_qdrant()
    
    synthetic_users = generate_synthetic_users(n_users=500)
    dt, int_to_path = train_decision_tree(synthetic_users)
    
    print("\n" + "="*60)
    print("STARTING CIRCULAR INTERVIEW")
    print("="*60)
    
    engine = CircularInterviewEngine(dt, int_to_path)
    
    user_intent = "I want to pay back my $20,000 loans in 3 years"
    best_path, all_scores = engine.run_interview(user_intent)
