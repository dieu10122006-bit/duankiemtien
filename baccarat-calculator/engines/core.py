"""
engines/core.py
Luat choi Baccarat dung chung cho tat ca cac bo may tinh toan.

Quy uoc gia tri la (rank value), khong quan tam chat (suit):
  0 -> 10, J, Q, K  (gia tri diem = 0)
  1 -> A             (gia tri diem = 1)
  2..9 -> gia tri diem tuong ung

Trong mot bo bai 52 la:
  gia tri 0 co 16 la (10,J,Q,K x 4 chat)
  gia tri 1..9 co 4 la moi gia tri
"""

RANKS = list(range(10))  # 0..9


def fresh_shoe_counts(num_decks: int):
    """So luong la bai con lai trong con bai (shoe) moi, theo tung gia tri diem."""
    counts = [4 * num_decks for _ in range(10)]
    counts[0] = 16 * num_decks
    return counts


def point(v: int) -> int:
    """Diem cua mot la bai (0-9 la da la diem roi)."""
    return v


def hand_total(cards):
    return sum(cards) % 10


def player_should_draw_third(player_total: int) -> bool:
    """Nguoi choi rut la thu 3 khi tong 2 la dau <= 5 (va khong co natural)."""
    return player_total <= 5


BANKER_DRAW_TABLE = {
    # banker_total: set cac gia tri la thu 3 cua Player khien Banker RUT bai
    # None trong player_third nghia la Player khong rut (dung voi 6,7)
    0: set(range(0, 10)) | {None},
    1: set(range(0, 10)) | {None},
    2: set(range(0, 10)) | {None},
    3: set(range(0, 10)) | {None} - {8},
    4: {2, 3, 4, 5, 6, 7} | {None},
    5: {4, 5, 6, 7} | {None},
    6: {6, 7},
    7: set(),  # Banker luon dung (stand)
}


def banker_should_draw_third(banker_total: int, player_third_value):
    """
    player_third_value: gia tri la thu 3 cua Player, hoac None neu Player khong rut.
    Chi goi ham nay khi banker_total <= 5 HOAC (banker_total==6/7 va Player co rut la thu 3).
    Quy tac chuan cua Baccarat (Punto Banco).
    """
    if banker_total <= 2:
        return True
    if banker_total >= 7:
        return False
    allowed = BANKER_DRAW_TABLE[banker_total]
    return player_third_value in allowed


def outcome_of(player_cards, banker_cards):
    """Tra ve 'Player' | 'Banker' | 'Tie' dua tren tay bai cuoi cung."""
    p = hand_total(player_cards)
    b = hand_total(banker_cards)
    if p > b:
        return "Player"
    if b > p:
        return "Banker"
    return "Tie"


def is_natural(total: int) -> bool:
    return total in (8, 9)
