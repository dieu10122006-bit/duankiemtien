"""
app.py - May Chu Tinh Xac Suat Baccarat
Flask web app voi nhieu "bo may" (engines) tinh toan doc lap.
"""
from flask import Flask, render_template, request, jsonify

from engines.exact_engine import compute_exact, compute_exact_cached
from engines.monte_carlo_engine import simulate
from engines.betting_engine import simulate_strategy, risk_of_ruin

app = Flask(__name__)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/exact", methods=["POST"])
def api_exact():
    data = request.get_json(force=True) or {}
    num_decks = int(data.get("num_decks", 8))
    num_decks = max(1, min(num_decks, 8))
    result = compute_exact_cached(num_decks)
    return jsonify(result)


@app.route("/api/shoe", methods=["POST"])
def api_shoe():
    """Bo may tinh xac suat co dieu kien khi da biet mot so la bai da bi rut
    khoi con bai (vd: dem bai / theo doi ket qua cac van truoc)."""
    data = request.get_json(force=True) or {}
    num_decks = int(data.get("num_decks", 8))
    removed = data.get("removed_counts")  # list 10 so nguyen, gia tri 0..9
    if not removed or len(removed) != 10:
        removed = [0] * 10
    removed = [max(0, int(x)) for x in removed]
    result = compute_exact(num_decks, removed_counts=removed)
    return jsonify(result)


@app.route("/api/montecarlo", methods=["POST"])
def api_montecarlo():
    data = request.get_json(force=True) or {}
    num_decks = int(data.get("num_decks", 8))
    num_hands = int(data.get("num_hands", 100000))
    num_hands = max(1000, min(num_hands, 2_000_000))
    seed = data.get("seed")
    result = simulate(num_decks, num_hands, seed=seed)
    return jsonify(result)


@app.route("/api/betting/simulate", methods=["POST"])
def api_betting_simulate():
    data = request.get_json(force=True) or {}
    result = simulate_strategy(
        strategy=data.get("strategy", "flat"),
        bet_on=data.get("bet_on", "Banker"),
        base_bet=float(data.get("base_bet", 10)),
        starting_bankroll=float(data.get("starting_bankroll", 1000)),
        num_hands=int(data.get("num_hands", 200)),
        num_decks=int(data.get("num_decks", 8)),
        stop_loss=data.get("stop_loss"),
        stop_win=data.get("stop_win"),
        seed=data.get("seed"),
    )
    # Chi tra ve toi da 2000 diem lich su de ve bieu do gon nhe
    hist = result["history"]
    if len(hist) > 2000:
        step = len(hist) // 2000
        hist = hist[::step]
    result["history"] = hist
    return jsonify(result)


@app.route("/api/betting/risk", methods=["POST"])
def api_betting_risk():
    data = request.get_json(force=True) or {}
    result = risk_of_ruin(
        strategy=data.get("strategy", "martingale"),
        bet_on=data.get("bet_on", "Banker"),
        base_bet=float(data.get("base_bet", 10)),
        starting_bankroll=float(data.get("starting_bankroll", 1000)),
        num_hands=int(data.get("num_hands", 200)),
        num_decks=int(data.get("num_decks", 8)),
        trials=int(data.get("trials", 300)),
    )
    return jsonify(result)


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
