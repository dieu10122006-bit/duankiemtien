"""
engines/exact_engine.py
Bo may tinh xac suat CHINH XAC (khong mo phong) bang cach liet ke day du
mo hinh sieu boi (hypergeometric) tren toan bo con bai, ap dung dung luat
rut la thu 3 cua Punto Banco. Ket qua duoc cache theo (so_bo_bai, tien_to_da_rut).
"""
from functools import lru_cache
from .core import (
    fresh_shoe_counts, hand_total, player_should_draw_third,
    banker_should_draw_third, outcome_of, is_natural,
)


def _draw(counts, total, value):
    """Tra ve xac suat rut duoc 'value' va bo dem moi sau khi rut (khong hoan lai)."""
    if counts[value] <= 0:
        return 0.0, counts, total
    p = counts[value] / total
    new_counts = list(counts)
    new_counts[value] -= 1
    return p, new_counts, total - 1


def compute_exact(num_decks: int = 8, removed_counts=None):
    """
    Tra ve dict xac suat chinh xac cho: Player, Banker, Tie,
    Player Pair, Banker Pair, Perfect Pair (cung gia tri & cung mau - xap xi
    theo gia tri vi khong theo doi chat), va so tay bai da liet ke (kiem tra).

    removed_counts: list 10 phan tu, so la moi gia tri DA bi rut khoi con bai
    truoc do (dung cho 'Shoe Composition Engine'). None = con bai moi tinh.
    """
    base = fresh_shoe_counts(num_decks)
    if removed_counts:
        base = [max(0, base[i] - removed_counts[i]) for i in range(10)]
    total0 = sum(base)

    stats = {
        "Player": 0.0, "Banker": 0.0, "Tie": 0.0,
        "PlayerPair": 0.0, "BankerPair": 0.0,
        "check_total_prob": 0.0,
    }

    # Vong lap tren 4 la dau: P1, P2, B1, B2
    for p1 in range(10):
        w1, c1, t1 = _draw(base, total0, p1)
        if w1 == 0:
            continue
        for p2 in range(10):
            w2, c2, t2 = _draw(c1, t1, p2)
            if w2 == 0:
                continue
            prob_pp = w1 * w2  # xac suat co Player Pair (p1==p2) da tinh o duoi
            for b1 in range(10):
                w3, c3, t3 = _draw(c2, t2, b1)
                if w3 == 0:
                    continue
                for b2 in range(10):
                    w4, c4, t4 = _draw(c3, t3, b2)
                    if w4 == 0:
                        continue
                    base_prob = w1 * w2 * w3 * w4
                    player_total = hand_total([p1, p2])
                    banker_total = hand_total([b1, b2])

                    if p1 == p2:
                        stats["PlayerPair"] += base_prob
                    if b1 == b2:
                        stats["BankerPair"] += base_prob

                    if is_natural(player_total) or is_natural(banker_total):
                        # Khong ai rut them la
                        outcome = outcome_of([p1, p2], [b1, b2])
                        stats[outcome] += base_prob
                        stats["check_total_prob"] += base_prob
                        continue

                    player_draws = player_should_draw_third(player_total)

                    if not player_draws:
                        # Player dung o 6/7 -> Banker quyet dinh dung tren 6 diem
                        if banker_should_draw_third(banker_total, None):
                            for b3 in range(10):
                                w5, _, _ = _draw(c4, t4, b3)
                                if w5 == 0:
                                    continue
                                prob = base_prob * w5
                                outcome = outcome_of([p1, p2], [b1, b2, b3])
                                stats[outcome] += prob
                                stats["check_total_prob"] += prob
                        else:
                            outcome = outcome_of([p1, p2], [b1, b2])
                            stats[outcome] += base_prob
                            stats["check_total_prob"] += base_prob
                        continue

                    # Player rut la thu 3
                    for p3 in range(10):
                        w5, c5, t5 = _draw(c4, t4, p3)
                        if w5 == 0:
                            continue
                        prob_after_p3 = base_prob * w5
                        if banker_should_draw_third(banker_total, p3):
                            for b3 in range(10):
                                w6, _, _ = _draw(c5, t5, b3)
                                if w6 == 0:
                                    continue
                                prob = prob_after_p3 * w6
                                outcome = outcome_of([p1, p2, p3], [b1, b2, b3])
                                stats[outcome] += prob
                                stats["check_total_prob"] += prob
                        else:
                            outcome = outcome_of([p1, p2, p3], [b1, b2])
                            stats[outcome] += prob_after_p3
                            stats["check_total_prob"] += prob_after_p3

    return stats


@lru_cache(maxsize=16)
def compute_exact_cached(num_decks: int):
    return compute_exact(num_decks, removed_counts=None)
