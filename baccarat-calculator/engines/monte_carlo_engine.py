"""
engines/monte_carlo_engine.py
Bo may mo phong Monte Carlo: xay dung con bai that (list la bai), xao bai,
choi tung van bai theo dung luat, rut ra tan suat + khoang tin cay 95%.
Dung de kiem chung Exact Engine va de mo phong khi con bai bi "an mon"
(rut dan, khong tra lai) qua nhieu van.
"""
import random
import math
from .core import (
    hand_total, player_should_draw_third, banker_should_draw_third,
    outcome_of, is_natural,
)


def build_shoe(num_decks: int):
    """1 bo bai (52 la) = 16 la gia tri 0 (10,J,Q,K x 4 chat) + 4 la moi gia tri 1..9."""
    shoe = []
    for _ in range(num_decks):
        shoe.extend([0] * 16)
        for v in range(1, 10):
            shoe.extend([v] * 4)
    random.shuffle(shoe)
    return shoe


def play_one_hand(shoe, cursor):
    """Choi 1 van tu vi tri cursor trong shoe. Tra ve (outcome, new_cursor, p_pair, b_pair)."""
    p = [shoe[cursor], shoe[cursor + 1]]
    b = [shoe[cursor + 2], shoe[cursor + 3]]
    cursor += 4
    p_pair = p[0] == p[1]
    b_pair = b[0] == b[1]

    pt, bt = hand_total(p), hand_total(b)
    if is_natural(pt) or is_natural(bt):
        return outcome_of(p, b), cursor, p_pair, b_pair

    p3 = None
    if player_should_draw_third(pt):
        p3 = shoe[cursor]
        cursor += 1
        p.append(p3)

    if (p3 is None and bt <= 5) or (p3 is not None and banker_should_draw_third(bt, p3)):
        b.append(shoe[cursor])
        cursor += 1

    return outcome_of(p, b), cursor, p_pair, b_pair


def simulate(num_decks: int, num_hands: int, cards_per_hand_reserve: int = 7,
             seed=None):
    """
    Mo phong num_hands van bai. Tu dong xao lai con bai moi khi sap het
    (giong casino dung 'the cat' - cut card).
    """
    if seed is not None:
        random.seed(seed)

    shoe = build_shoe(num_decks)
    cursor = 0
    counts = {"Player": 0, "Banker": 0, "Tie": 0, "PlayerPair": 0, "BankerPair": 0}

    for _ in range(num_hands):
        if cursor + cards_per_hand_reserve >= len(shoe):
            shoe = build_shoe(num_decks)
            cursor = 0
        outcome, cursor, p_pair, b_pair = play_one_hand(shoe, cursor)
        counts[outcome] += 1
        if p_pair:
            counts["PlayerPair"] += 1
        if b_pair:
            counts["BankerPair"] += 1

    result = {}
    for k in ["Player", "Banker", "Tie", "PlayerPair", "BankerPair"]:
        p_hat = counts[k] / num_hands
        # khoang tin cay 95% (xap xi normal cho ty le)
        se = math.sqrt(max(p_hat * (1 - p_hat), 1e-9) / num_hands)
        result[k] = {
            "prob": p_hat,
            "count": counts[k],
            "ci_low": max(0.0, p_hat - 1.96 * se),
            "ci_high": min(1.0, p_hat + 1.96 * se),
        }
    result["num_hands"] = num_hands
    return result
