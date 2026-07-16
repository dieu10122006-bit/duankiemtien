"""
engines/betting_engine.py
Bo may mo phong CAC HE THONG DAT CUOC (betting systems) tren nen xac suat
that cua Baccarat, de minh hoa bang toan hoc rang khong he thong dat cuoc
nao thay doi duoc loi the nha cai (house edge) ve lau dai.
Chi phuc vu muc dich giao duc / thong ke - khong phai loi khuyen ca cuoc.
"""
import random
from .monte_carlo_engine import build_shoe, play_one_hand


PAYOUTS = {
    "Banker": 0.95,  # thang Banker thu commission 5%
    "Player": 1.0,
    "Tie": 8.0,
}


def _next_bet_martingale(base, last_bet, won):
    return base if won else last_bet * 2


def _next_bet_fibonacci(base, state, won):
    # state: index hien tai trong day Fibonacci
    fib = [1, 1]
    while len(fib) < state + 3:
        fib.append(fib[-1] + fib[-2])
    if won:
        state = max(0, state - 2)
    else:
        state = state + 1
    return base * fib[state], state


def _next_bet_dalembert(base, unit, last_bet, won):
    unit = max(1, unit - 1) if won else unit + 1
    return base * unit, unit


def _next_bet_paroli(base, last_bet, won, streak):
    # tang cuoc khi thang, toi da 3 lan thang lien tiep roi reset
    if won:
        streak += 1
        if streak >= 3:
            return base, 0
        return last_bet * 2, streak
    return base, 0


def simulate_strategy(strategy: str, bet_on: str, base_bet: float,
                       starting_bankroll: float, num_hands: int,
                       num_decks: int = 8, stop_loss=None, stop_win=None,
                       seed=None):
    """
    strategy: 'flat' | 'martingale' | 'fibonacci' | 'dalembert' | 'paroli'
    bet_on: 'Banker' | 'Player' | 'Tie'
    Tra ve lich su bankroll theo tung van + thong ke tong hop.
    """
    if seed is not None:
        random.seed(seed)

    shoe = build_shoe(num_decks)
    cursor = 0
    bankroll = starting_bankroll
    bet = base_bet
    fib_state = 0
    dalembert_unit = 1
    paroli_streak = 0

    history = [bankroll]
    hands_played = 0
    busted = False
    hit_stop_win = False

    for _ in range(num_hands):
        if cursor + 7 >= len(shoe):
            shoe = build_shoe(num_decks)
            cursor = 0

        if bet > bankroll:
            bet = bankroll  # dat het von con lai (all-in) thay vi dung cuoc am

        outcome, cursor, _, _ = play_one_hand(shoe, cursor)
        hands_played += 1
        won = (outcome == bet_on)

        if won:
            bankroll += bet * PAYOUTS[bet_on]
        else:
            bankroll -= bet
        # Hoa (Tie) khi khong cuoc Tie thuong duoc hoan tien - ap dung luat do
        if outcome == "Tie" and bet_on != "Tie":
            bankroll += bet  # hoan lai tien cuoc, van bai coi nhu khong tinh
            won_for_progression = None
        else:
            won_for_progression = won

        history.append(bankroll)

        if won_for_progression is not None:
            if strategy == "flat":
                bet = base_bet
            elif strategy == "martingale":
                bet = _next_bet_martingale(base_bet, bet, won_for_progression)
            elif strategy == "fibonacci":
                bet, fib_state = _next_bet_fibonacci(base_bet, fib_state, won_for_progression)
            elif strategy == "dalembert":
                bet, dalembert_unit = _next_bet_dalembert(base_bet, dalembert_unit, bet, won_for_progression)
            elif strategy == "paroli":
                bet, paroli_streak = _next_bet_paroli(base_bet, bet, won_for_progression, paroli_streak)
            else:
                bet = base_bet

        if bankroll <= 0:
            busted = True
            break
        if stop_loss is not None and bankroll <= starting_bankroll - stop_loss:
            break
        if stop_win is not None and bankroll >= starting_bankroll + stop_win:
            hit_stop_win = True
            break

    return {
        "history": history,
        "hands_played": hands_played,
        "final_bankroll": bankroll,
        "busted": busted,
        "hit_stop_win": hit_stop_win,
        "net_result": bankroll - starting_bankroll,
    }


def risk_of_ruin(strategy: str, bet_on: str, base_bet: float,
                  starting_bankroll: float, num_hands: int,
                  num_decks: int = 8, trials: int = 500, seed=None):
    """Chay nhieu lan mo phong doc lap de uoc luong % kha nang 'chay' (mat het von)."""
    if seed is not None:
        random.seed(seed)
    busts = 0
    finals = []
    for i in range(trials):
        r = simulate_strategy(strategy, bet_on, base_bet, starting_bankroll,
                               num_hands, num_decks)
        if r["busted"]:
            busts += 1
        finals.append(r["final_bankroll"])
    avg_final = sum(finals) / len(finals)
    return {
        "trials": trials,
        "bust_probability": busts / trials,
        "avg_final_bankroll": avg_final,
        "avg_net_result": avg_final - starting_bankroll,
    }
