"""
CIRCULAR AGENTIC SYSTEM - ROOT-CAUSE FIX

Three fixes:
1. Synthetic data now has a REAL relationship between features and the best path,
   so the decision tree can actually learn (fixes frozen probabilities).
2. Domain selection is driven by the tree's feature_importances_ (information gain),
   so we ask about the most useful unanswered domain each time (fixes "always debt").
3. Question retrieval filters Qdrant by the chosen domain, so the same question
   can never be asked twice (fixes repeated question).
"""
from pathlib import Path
from dotenv import load_dotenv
import os

env_path = Path(__file__).parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

QDRANT_URL = os.getenv("QDRANT_URL")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY")

if not QDRANT_URL or not QDRANT_API_KEY:
    raise ValueError("QDRANT_URL and QDRANT_API_KEY must be set in .env file")

import numpy as np
from qdrant_client import QdrantClient
from qdrant_client.models import VectorParams, Distance, PointStruct, Filter, FieldCondition, MatchValue
from sentence_transformers import SentenceTransformer
from sklearn.tree import DecisionTreeClassifier

client = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY, prefer_grpc=False)
embedding_model = SentenceTransformer('all-MiniLM-L6-v2')

DOMAIN_ORDER = ["debt", "income", "timeline", "risk_tolerance", "savings", "credit_score"]
ALL_PATHS = ["aggressive_debt_payoff", "balanced_debt_and_savings",
             "invest_while_paying_minimum", "income_boost_first"]

# ============================================================================
# Version-agnostic Qdrant search helper
# ============================================================================

def qdrant_search(collection, vector, limit=10, query_filter=None):
    """Works with both old (search) and new (query_points) Qdrant clients."""
    if hasattr(client, "search"):
        return list(client.search(
            collection_name=collection,
            query_vector=vector,
            limit=limit,
            query_filter=query_filter
        ))
    res = client.query_points(
        collection_name=collection,
        query=vector,
        limit=limit,
        query_filter=query_filter
    )
    return res.points

# ============================================================================
# PART 1: SYNTHETIC DATA  (FIX #1 — real feature -> path signal)
# ============================================================================

def best_path_for(fv):
    """
    Deterministic rule: given a feature profile, which path is actually best?
    This is what creates learnable signal.
    fv = [debt, income, timeline, risk_tolerance, savings, credit_score]
    """
    debt, income, timeline, risk, savings, credit = fv
    if debt > 0.6 and income < 0.45:
        return "aggressive_debt_payoff"          # high debt, low income -> attack debt
    if income > 0.55 and savings > 0.45 and risk > 0.5:
        return "invest_while_paying_minimum"     # comfortable + risk-tolerant -> invest
    if income < 0.35 or timeline > 0.7:
        return "income_boost_first"              # very low income or relaxed timeline -> earn more
    return "balanced_debt_and_savings"           # everyone else -> balance

def generate_synthetic_users(n_users=600):
    """
    Most users (75%) take the best path for their profile; 25% take a
    suboptimal path. Outcome is high when the chosen path matched their profile.
    """
    users = []
    for user_id in range(n_users):
        fv = np.random.rand(6)
        best = best_path_for(fv)

        if np.random.rand() < 0.75:
            taken = best
        else:
            taken = np.random.choice([p for p in ALL_PATHS if p != best])

        if taken == best:
            outcome = 0.85 + np.random.normal(0, 0.07)
        else:
            outcome = 0.45 + np.random.normal(0, 0.10)
        outcome = float(min(1.0, max(0.0, outcome)))

        users.append({
            "user_id": user_id,
            "feature_vector": fv.tolist(),
            "path_taken": taken,
            "outcome_success": outcome
        })
    return users

# ============================================================================
# PART 2: QDRANT SETUP
# ============================================================================

def setup_qdrant(synthetic_users):
    print("Setting up Qdrant...")

    for coll, size in [("questions", 384), ("user_paths", 6)]:
        try:
            client.delete_collection(collection_name=coll)
        except:
            pass
        client.create_collection(
            collection_name=coll,
            vectors_config=VectorParams(size=size, distance=Distance.COSINE)
        )

    # Create payload index on 'domain' so we can filter by it
    client.create_payload_index(
        collection_name="questions",
        field_name="domain",
        field_schema="keyword"
    )

    # Create payload index on 'path_taken' for filtering user paths (optional, future use)
    client.create_payload_index(
        collection_name="user_paths",
        field_name="path_taken",
        field_schema="keyword"
    )

    print("✓ Collections created")

    questions_list = [
        {"id": "q_1", "text": "What is your total debt amount?", "domain": "debt"},
        {"id": "q_2", "text": "What is your monthly income?", "domain": "income"},
        {"id": "q_3", "text": "In how many years do you want to be debt-free?", "domain": "timeline"},
        {"id": "q_4", "text": "How comfortable are you with financial risk? (low/medium/high)", "domain": "risk_tolerance"},
        {"id": "q_5", "text": "How much do you have saved currently?", "domain": "savings"},
        {"id": "q_6", "text": "What is your credit score?", "domain": "credit_score"},
    ]
    qpoints = []
    for i, q in enumerate(questions_list):
        emb = embedding_model.encode(q["text"])
        qpoints.append(PointStruct(id=i, vector=emb, payload=q))
    client.upsert(collection_name="questions", points=qpoints)
    print(f"✓ Uploaded {len(qpoints)} questions")

    upoints = []
    for i, u in enumerate(synthetic_users):
        fv = np.array(u["feature_vector"])
        fv = fv / (np.linalg.norm(fv) + 1e-8)   # normalize for cosine search
        upoints.append(PointStruct(
            id=i,
            vector=fv.tolist(),
            payload={
                "user_id": u["user_id"],
                "path_taken": u["path_taken"],
                "outcome_success": u["outcome_success"],
                "feature_vector": u["feature_vector"]
            }
        ))
    client.upsert(collection_name="user_paths", points=upoints)
    print(f"✓ Uploaded {len(upoints)} synthetic users")

# ============================================================================
# PART 3: DECISION TREE
# ============================================================================

def train_decision_tree(synthetic_users):
    X = np.array([u["feature_vector"] for u in synthetic_users])
    path_to_int = {p: i for i, p in enumerate(ALL_PATHS)}
    y = np.array([path_to_int[u["path_taken"]] for u in synthetic_users])

    dt = DecisionTreeClassifier(max_depth=6, random_state=42)
    dt.fit(X, y)

    # Show that the tree actually learned something
    train_acc = dt.score(X, y)
    int_to_path = {v: k for k, v in path_to_int.items()}
    print(f"✓ Decision tree trained (train accuracy: {train_acc:.2f})")
    print(f"  Feature importances:")
    for d, imp in zip(DOMAIN_ORDER, dt.feature_importances_):
        print(f"    {d:15s}: {imp:.3f}")
    return dt, int_to_path

# ============================================================================
# PART 4: CIRCULAR INTERVIEW ENGINE
# ============================================================================

class CircularInterviewEngine:
    def __init__(self, decision_tree, int_to_path):
        self.dt = decision_tree
        self.int_to_path = int_to_path
        self.feature_vector_partial = {}
        self.asked_domains = []
        self.iteration = 0
        self.max_iterations = 6
        self.confidence_threshold = 0.30   # gap between best and 2nd-best path score

    # ---------- FIX #3: question retrieval filtered by domain ----------
    def select_next_question(self, user_intent, target_domain):
        context = user_intent
        for d, s in self.feature_vector_partial.items():
            context += f" {d}: {s:.2f}"
        emb = embedding_model.encode(context).tolist()

        flt = Filter(must=[FieldCondition(key="domain", match=MatchValue(value=target_domain))])
        results = qdrant_search("questions", emb, limit=1, query_filter=flt)

        if results:
            p = results[0].payload
            return p["question_id"], p["question_text"], p["domain"]
        return None, None, None

    def normalize_answer(self, answer_text, domain):
        low = answer_text.lower()
        digits = ''.join(c for c in answer_text if c.isdigit() or c == '.')
        if domain == "debt":
            try: return min(1.0, float(digits) / 100000.0)
            except: return 0.5
        if domain == "income":
            try: return min(1.0, float(digits) / 10000.0)
            except: return 0.5
        if domain == "timeline":
            try: return min(1.0, float(digits) / 10.0)
            except: return 0.5
        if domain == "risk_tolerance":
            if "low" in low: return 0.3
            if "high" in low: return 0.9
            return 0.6
        if domain == "savings":
            try: return min(1.0, float(digits) / 50000.0)
            except: return 0.5
        if domain == "credit_score":
            try: return min(1.0, float(digits) / 850.0)
            except: return 0.5
        return 0.5

    def fill_partial_vector(self):
        return np.array([self.feature_vector_partial.get(d, 0.5) for d in DOMAIN_ORDER])

    def predict_paths(self):
        fv = self.fill_partial_vector()
        probs = self.dt.predict_proba([fv])[0]
        top = np.argsort(probs)[-3:][::-1]
        return [self.int_to_path[i] for i in top], [probs[i] for i in top]

    def validate_paths(self):
        candidate_paths, _ = self.predict_paths()
        fv = self.fill_partial_vector()
        fv = fv / (np.linalg.norm(fv) + 1e-8)

        scores = {}
        for path in candidate_paths:
            results = qdrant_search("user_paths", fv.tolist(), limit=20)
            matching = [r for r in results if r.payload["path_taken"] == path]
            if matching:
                outcomes = [r.payload["outcome_success"] for r in matching]
                scores[path] = {"score": float(np.mean(outcomes)),
                                "n_similar": len(matching), "outcomes": outcomes}
            else:
                scores[path] = {"score": 0.0, "n_similar": 0, "outcomes": []}
        return scores

    def calculate_confidence(self, path_scores):
        ordered = sorted(path_scores.values(), key=lambda x: x["score"], reverse=True)
        if len(ordered) < 2:
            return 0.5
        return float(ordered[0]["score"] - ordered[1]["score"])

    # ---------- FIX #2: domain selection by information gain ----------
    def choose_next_domain(self):
        importances = self.dt.feature_importances_
        candidates = [(DOMAIN_ORDER[i], importances[i])
                      for i in range(len(DOMAIN_ORDER))
                      if DOMAIN_ORDER[i] not in self.asked_domains]
        if not candidates:
            return None
        candidates.sort(key=lambda x: x[1], reverse=True)  # most informative first
        return candidates[0][0]

    def run_interview(self, user_intent):
        print(f"\n{'='*60}\nCIRCULAR AGENTIC INTERVIEW\n{'='*60}")
        print(f"User intent: {user_intent}")

        while self.iteration < self.max_iterations:
            self.iteration += 1
            print(f"\n--- Iteration {self.iteration} ---")

            candidate_paths, probs = self.predict_paths()
            print(f"Feature vector: {[f'{v:.2f}' for v in self.fill_partial_vector()]}")
            print(f"Predicted paths: {candidate_paths}")
            print(f"Probabilities:   {[f'{p:.2f}' for p in probs]}")

            path_scores = self.validate_paths()
            print("Path validation (Search #2):")
            for path, d in path_scores.items():
                print(f"  {path}: score={d['score']:.2f}, n_similar={d['n_similar']}")

            confidence = self.calculate_confidence(path_scores)
            print(f"Confidence (score gap): {confidence:.2f}")

            if confidence > self.confidence_threshold:
                print(f"✓ Confident enough (gap > {self.confidence_threshold})")
                return self._finalize(max(path_scores.items(), key=lambda x: x[1]["score"]), path_scores)

            if self.iteration >= self.max_iterations:
                print("✓ Max iterations reached")
                return self._finalize(max(path_scores.items(), key=lambda x: x[1]["score"]), path_scores)

            next_domain = self.choose_next_domain()
            if not next_domain:
                print("No more domains to ask about")
                return self._finalize(max(path_scores.items(), key=lambda x: x[1]["score"]), path_scores)

            print(f"Most informative unanswered domain: {next_domain}")
            qid, qtext, domain = self.select_next_question(user_intent, next_domain)
            if not qtext:
                print(f"Could not find question for {next_domain}")
                break

            print(f"\nQ{self.iteration} ({domain}): {qtext}")
            answer = input("> ")
            scalar = self.normalize_answer(answer, domain)
            self.feature_vector_partial[domain] = scalar
            self.asked_domains.append(domain)
            print(f"Normalized to {scalar:.2f}")

        return self._finalize(max(self.validate_paths().items(), key=lambda x: x[1]["score"]),
                              self.validate_paths())

    def _finalize(self, best_path, all_scores):
        name, data = best_path
        print(f"\n{'='*60}\nFINAL RECOMMENDATION\n{'='*60}")
        print(f"Path: {name}")
        print(f"Score: {data['score']:.2f}  (based on {data['n_similar']} similar users)")
        print(f"Their outcomes: {[f'{o:.2f}' for o in data['outcomes'][:5]]}")
        print(f"Questions asked: {self.iteration}")
        print(f"Domains covered: {self.asked_domains}")
        print(f"Final feature vector: {[f'{v:.2f}' for v in self.fill_partial_vector()]}")
        return name, all_scores

# ============================================================================
# PART 5: MAIN
# ============================================================================

if __name__ == "__main__":
    print("Setting up system...")
    users = generate_synthetic_users(n_users=600)
    setup_qdrant(users)
    dt, int_to_path = train_decision_tree(users)

    print("\n" + "="*60 + "\nSTARTING CIRCULAR INTERVIEW\n" + "="*60)
    engine = CircularInterviewEngine(dt, int_to_path)
    engine.run_interview("I want to pay back my $20,000 loans in 3 years")
