"""
PATHFINDER BACKEND — stateless HTTP service

Implements the frontend data contract:
  POST /roadmap/next
    in : { notes, structured[], answers[] }
    out: { status: "question", question, constraints }   (need more info)
         { status: "complete", roadmap, constraints, rationale }  (done)

Covers Priority 0 (HTTP + steps[]), Priority 1 (Qdrant solid, loop cleanup,
question cap), and Priority 3 (constraints + rationale).

Priority 2 (Bedrock) is left for the integrator — swap points are marked
with  >>> BEDROCK SWAP  comments.

Run:
    pip install fastapi uvicorn pydantic qdrant-client sentence-transformers scikit-learn python-dotenv numpy
    python3 -m uvicorn agent_system:app --port 8000

Test:
    curl -X POST http://localhost:8000/roadmap/next \
      -H "Content-Type: application/json" \
      -d '{"notes":"pay back 20k loans in 3 years","answers":[]}'
"""

from pathlib import Path
from dotenv import load_dotenv, find_dotenv
import os

# Load .env wherever it lives (src/ or project root), however the app is launched.
_here = Path(__file__).resolve().parent
for _candidate in (_here / ".env", _here.parent / ".env"):
    if _candidate.exists():
        load_dotenv(dotenv_path=_candidate)
        break
else:
    load_dotenv(find_dotenv(usecwd=True))

QDRANT_URL = os.getenv("QDRANT_URL")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY")
if not QDRANT_URL or not QDRANT_API_KEY:
    raise ValueError("QDRANT_URL and QDRANT_API_KEY must be set in .env file")

from typing import List, Optional
import numpy as np
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from qdrant_client import QdrantClient
from qdrant_client.models import (
    VectorParams, Distance, PointStruct, Filter, FieldCondition, MatchValue
)
from sentence_transformers import SentenceTransformer
from sklearn.tree import DecisionTreeClassifier

# ----------------------------------------------------------------------------
# Constants
# ----------------------------------------------------------------------------

DOMAIN_ORDER = ["debt", "income", "timeline", "risk_tolerance", "savings", "credit_score"]
ALL_PATHS = ["aggressive_debt_payoff", "balanced_debt_and_savings",
             "invest_while_paying_minimum", "income_boost_first"]

MAX_QUESTIONS = 3          # cap clarifying questions for the demo
CONFIDENCE_GAP = 0.30      # stop early if best path beats 2nd by this much

EMBED_DIM = 384            # >>> BEDROCK SWAP: Titan embeddings use a different size;
                           #     change this AND re-seed collections together.

ICONS = {"debt": "💰", "income": "💵", "timeline": "⏳",
         "risk_tolerance": "📊", "savings": "🏦", "credit_score": "📈"}

# ----------------------------------------------------------------------------
# Clients
# ----------------------------------------------------------------------------

client = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY, prefer_grpc=False)
# >>> BEDROCK SWAP: replace this with a Bedrock Titan embeddings call.
embedding_model = SentenceTransformer('all-MiniLM-L6-v2')


def embed(text: str) -> list:
    """Single place that produces embeddings — swap to Bedrock here."""
    return embedding_model.encode(text).tolist()


def qdrant_search(collection, vector, limit=10, query_filter=None):
    """Version-agnostic search (old `search` vs new `query_points`)."""
    if hasattr(client, "search"):
        return list(client.search(
            collection_name=collection, query_vector=vector,
            limit=limit, query_filter=query_filter))
    res = client.query_points(
        collection_name=collection, query=vector,
        limit=limit, query_filter=query_filter)
    return res.points

# ----------------------------------------------------------------------------
# Synthetic data + setup (Priority 1)
# ----------------------------------------------------------------------------

def best_path_for(fv):
    debt, income, timeline, risk, savings, credit = fv
    if debt > 0.6 and income < 0.45:
        return "aggressive_debt_payoff"
    if income > 0.55 and savings > 0.45 and risk > 0.5:
        return "invest_while_paying_minimum"
    if income < 0.35 or timeline > 0.7:
        return "income_boost_first"
    return "balanced_debt_and_savings"


def generate_synthetic_users(n_users=600, seed=42):
    rng = np.random.RandomState(seed)  # deterministic so tree + Qdrant stay in sync
    users = []
    for user_id in range(n_users):
        fv = rng.rand(6)
        best = best_path_for(fv)
        if rng.rand() < 0.75:
            taken = best
        else:
            taken = rng.choice([p for p in ALL_PATHS if p != best])
        outcome = (0.85 if taken == best else 0.45) + rng.normal(0, 0.08)
        users.append({
            "user_id": user_id,
            "feature_vector": fv.tolist(),
            "path_taken": taken,
            "outcome_success": float(min(1.0, max(0.0, outcome))),
        })
    return users


def _collection_ready(name):
    try:
        return client.count(collection_name=name, exact=True).count > 0
    except Exception:
        return False


def _ensure_indexes():
    for coll, field in [("questions", "domain"), ("user_paths", "path_taken")]:
        try:
            client.create_payload_index(collection_name=coll, field_name=field, field_schema="keyword")
        except Exception:
            pass  # already exists


def setup_qdrant(users):
    print("Seeding Qdrant collections...")
    for coll, size in [("questions", EMBED_DIM), ("user_paths", 6)]:
        try:
            client.delete_collection(collection_name=coll)
        except Exception:
            pass
        client.create_collection(
            collection_name=coll,
            vectors_config=VectorParams(size=size, distance=Distance.COSINE))
    _ensure_indexes()

    questions = [
        {"id": "q_1", "text": "What is your total debt amount?", "domain": "debt"},
        {"id": "q_2", "text": "What is your monthly income?", "domain": "income"},
        {"id": "q_3", "text": "In how many years do you want to be debt-free?", "domain": "timeline"},
        {"id": "q_4", "text": "How comfortable are you with financial risk? (low/medium/high)", "domain": "risk_tolerance"},
        {"id": "q_5", "text": "How much do you have saved currently?", "domain": "savings"},
        {"id": "q_6", "text": "What is your credit score?", "domain": "credit_score"},
    ]
    client.upsert(collection_name="questions", points=[
        PointStruct(id=i, vector=embed(q["text"]), payload=q) for i, q in enumerate(questions)
    ])

    pts = []
    for i, u in enumerate(users):
        fv = np.array(u["feature_vector"])
        fv = fv / (np.linalg.norm(fv) + 1e-8)
        pts.append(PointStruct(id=i, vector=fv.tolist(), payload=u))
    client.upsert(collection_name="user_paths", points=pts)
    print(f"  seeded {len(questions)} questions, {len(pts)} users")


def ensure_setup(users):
    if _collection_ready("questions") and _collection_ready("user_paths"):
        _ensure_indexes()
        return
    setup_qdrant(users)


def train_decision_tree(users):
    X = np.array([u["feature_vector"] for u in users])
    p2i = {p: i for i, p in enumerate(ALL_PATHS)}
    y = np.array([p2i[u["path_taken"]] for u in users])
    dt = DecisionTreeClassifier(max_depth=6, random_state=42).fit(X, y)
    return dt, {v: k for k, v in p2i.items()}

# ----------------------------------------------------------------------------
# Core engine helpers (stateless)
# ----------------------------------------------------------------------------

def normalize_answer(value, domain):
    low = str(value).lower()
    digits = ''.join(c for c in str(value) if c.isdigit() or c == '.')
    try:
        num = float(digits)
    except Exception:
        num = None
    if domain == "debt":          return min(1.0, num / 100000.0) if num is not None else 0.5
    if domain == "income":        return min(1.0, num / 10000.0) if num is not None else 0.5
    if domain == "timeline":      return min(1.0, num / 10.0) if num is not None else 0.5
    if domain == "savings":       return min(1.0, num / 50000.0) if num is not None else 0.5
    if domain == "credit_score":  return min(1.0, num / 850.0) if num is not None else 0.5
    if domain == "risk_tolerance":
        if "low" in low:  return 0.3
        if "high" in low: return 0.9
        return 0.6
    return 0.5


def fill_vector(partial: dict) -> np.ndarray:
    return np.array([partial.get(d, 0.5) for d in DOMAIN_ORDER])


def predict_paths(dt, int_to_path, fv):
    probs = dt.predict_proba([fv])[0]
    top = np.argsort(probs)[-3:][::-1]
    return [int_to_path[i] for i in top]


def validate_paths(dt, int_to_path, fv):
    """
    SEARCH #2 — for each candidate path, find the nearest users *who took that
    path* and average their outcomes.

    FIXED: the path filter is applied INSIDE the Qdrant search (using the
    path_taken index) instead of filtering 20 generic neighbors afterwards.
    This guarantees each path is scored against ~15 real similar users, not 1.
    """
    candidate_paths = predict_paths(dt, int_to_path, fv)
    q = fv / (np.linalg.norm(fv) + 1e-8)
    scores = {}
    for path in candidate_paths:
        flt = Filter(must=[FieldCondition(key="path_taken", match=MatchValue(value=path))])
        results = qdrant_search("user_paths", q.tolist(), limit=15, query_filter=flt)
        if results:
            outs = [r.payload["outcome_success"] for r in results]
            scores[path] = {"score": float(np.mean(outs)), "n_similar": len(results)}
        else:
            scores[path] = {"score": 0.0, "n_similar": 0}
    return scores


def confidence_gap(scores):
    ordered = sorted(scores.values(), key=lambda x: x["score"], reverse=True)
    return float(ordered[0]["score"] - ordered[1]["score"]) if len(ordered) >= 2 else 0.5


def choose_next_domain(dt, asked_domains):
    imp = dt.feature_importances_
    cands = [(DOMAIN_ORDER[i], imp[i]) for i in range(len(DOMAIN_ORDER))
             if DOMAIN_ORDER[i] not in asked_domains]
    if not cands:
        return None
    cands.sort(key=lambda x: x[1], reverse=True)
    return cands[0][0]


def select_question(notes, partial, target_domain):
    context = notes
    for d, s in partial.items():
        context += f" {d}: {s:.2f}"
    flt = Filter(must=[FieldCondition(key="domain", match=MatchValue(value=target_domain))])
    res = qdrant_search("questions", embed(context), limit=1, query_filter=flt)
    if res:
        p = res[0].payload
        return {"id": p["id"], "text": p["text"], "domain": p["domain"]}
    return None

# ----------------------------------------------------------------------------
# steps[] expansion (Priority 0)  — templated per path for v1
# >>> BEDROCK SWAP: generate these steps with Claude/Nova instead of templates.
# ----------------------------------------------------------------------------

PATH_STEPS = {
    "aggressive_debt_payoff": [
        ("Build a $1,000 starter emergency fund", "easy", False),
        ("List every debt by interest rate", "easy", False),
        ("Cut discretionary spending to free up cash", "medium", False),
        ("Throw everything at the highest-interest debt", "hard", False),
        ("Avoid taking on any new debt while paying down", "medium", True),
    ],
    "balanced_debt_and_savings": [
        ("Build a one-month emergency fund", "easy", False),
        ("Automate minimum payments on all debt", "easy", False),
        ("Split monthly surplus between debt and savings", "medium", False),
        ("Increase retirement contributions gradually", "medium", False),
        ("Watch for lifestyle creep eroding your surplus", "medium", True),
    ],
    "invest_while_paying_minimum": [
        ("Confirm your debt is low-interest before investing", "easy", False),
        ("Build a three-month emergency fund", "medium", False),
        ("Capture the full employer 401(k) match", "medium", False),
        ("Open and fund a brokerage or IRA", "medium", False),
        ("Stay calm through short-term market volatility", "hard", True),
    ],
    "income_boost_first": [
        ("Audit your skills against current market rates", "easy", False),
        ("Identify a side income or a raise opportunity", "medium", False),
        ("Invest in one high-ROI skill or certification", "medium", False),
        ("Redirect all new income to debt and savings", "medium", False),
        ("Avoid burnout from overcommitting", "hard", True),
    ],
}


def build_roadmap(path, goal):
    steps = []
    for i, (title, difficulty, is_risk) in enumerate(PATH_STEPS[path]):
        steps.append({
            "id": i,
            "title": title,
            "difficulty": difficulty,
            "status": "in_progress" if i == 0 else "not_started",
            "is_risk": is_risk,
        })
    return {"domain": "finance", "goal": goal, "steps": steps}


def build_constraints(answers):
    out = []
    for a in answers:
        digits = ''.join(c for c in str(a.value) if c.isdigit())
        money = f"${int(digits):,}" if digits else str(a.value)
        if a.domain == "debt":            label = f"{money} debt"
        elif a.domain == "income":        label = f"{money}/mo income"
        elif a.domain == "timeline":      label = f"{a.value}-yr timeline"
        elif a.domain == "savings":       label = f"{money} saved"
        elif a.domain == "credit_score":  label = f"{a.value} credit score"
        elif a.domain == "risk_tolerance":label = f"{a.value} risk tolerance"
        else:                             label = str(a.value)
        out.append({"icon": ICONS.get(a.domain, "•"), "label": label})
    return out

# ----------------------------------------------------------------------------
# FastAPI app
# ----------------------------------------------------------------------------

class Answer(BaseModel):
    domain: str
    questionId: Optional[str] = None
    value: str

class StructuredItem(BaseModel):
    heading: str
    points: List[str] = []

class NextRequest(BaseModel):
    notes: str = ""
    structured: List[StructuredItem] = []
    answers: List[Answer] = []

app = FastAPI(title="Pathfinder Backend")
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# Load once at import (single worker for the demo).
print("Initializing Pathfinder backend...")
_USERS = generate_synthetic_users(600, seed=42)
ensure_setup(_USERS)
DT, INT_TO_PATH = train_decision_tree(_USERS)
print("Ready.")


def derive_goal(req: NextRequest) -> str:
    if req.notes.strip():
        return req.notes.strip().splitlines()[0][:80]
    if req.structured:
        return req.structured[0].heading
    return "Reach your financial goals"


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/roadmap/next")
def roadmap_next(req: NextRequest):
    # Rebuild state from the answers the frontend resends (stateless).
    partial, asked = {}, []
    for a in req.answers:
        partial[a.domain] = normalize_answer(a.value, a.domain)
        asked.append(a.domain)

    constraints = build_constraints(req.answers)
    fv = fill_vector(partial)
    scores = validate_paths(DT, INT_TO_PATH, fv)
    gap = confidence_gap(scores)

    enough = len(asked) >= MAX_QUESTIONS or gap > CONFIDENCE_GAP

    # Ask another question if we still need info and a domain remains.
    if not enough:
        next_domain = choose_next_domain(DT, asked)
        if next_domain:
            question = select_question(req.notes, partial, next_domain)
            if question:
                return {"status": "question", "question": question, "constraints": constraints}

    # Otherwise, finalize the roadmap.
    best_path, best_data = max(scores.items(), key=lambda x: x[1]["score"])
    return {
        "status": "complete",
        "roadmap": build_roadmap(best_path, derive_goal(req)),
        "constraints": constraints,
        "rationale": {
            "path": best_path,
            "similarUsers": best_data["n_similar"],
            "successRate": round(best_data["score"], 2),
        },
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
