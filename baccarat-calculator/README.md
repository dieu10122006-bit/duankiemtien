# Bàn Tính Baccarat — Phòng Xác Suất

Web app Python (Flask) gồm **4 bộ máy tính toán độc lập** cho môn Baccarat (Punto Banco):

1. **Exact Engine** (`engines/exact_engine.py`) — liệt kê đầy đủ (enumerate) mọi tổ hợp lá bài
   theo mô hình siêu bội (hypergeometric), áp dụng đúng luật rút lá thứ 3. Cho kết quả
   xác suất **chính xác tuyệt đối**, không xấp xỉ.
2. **Shoe / Card-Counting Engine** — tái sử dụng Exact Engine nhưng cho phép nhập số lá
   đã bị rút khỏi shoe, tính xác suất **có điều kiện** trên phần bài còn lại.
3. **Monte Carlo Engine** (`engines/monte_carlo_engine.py`) — mô phỏng hàng trăm nghìn ván
   bài thật (xáo bài, rút bài không hoàn lại), dùng để kiểm chứng chéo Exact Engine và
   tính khoảng tin cậy 95%.
4. **Betting Strategy Engine** (`engines/betting_engine.py`) — mô phỏng các hệ thống quản lý
   vốn (Flat, Martingale, Fibonacci, D'Alembert, Paroli) và ước lượng nguy cơ cháy vốn.

## Cài đặt & chạy

```bash
pip install -r requirements.txt
python app.py
```

Sau đó mở trình duyệt tại `http://127.0.0.1:5000`.

## Cấu trúc thư mục

```
app.py                     # Flask app + các route API
engines/
  core.py                  # Luật bài Punto Banco dùng chung
  exact_engine.py          # Bộ 1 & 2
  monte_carlo_engine.py    # Bộ 3
  betting_engine.py        # Bộ 4
templates/index.html       # Giao diện 1 trang, 4 tab
static/css/style.css       # Thiết kế "bàn dạ xanh / đồng thau / bảng cầu"
static/js/main.js          # Gọi API + vẽ bảng cầu (bead road) bằng SVG
```

## Lưu ý

Công cụ mang tính **thống kê / giáo dục**. Kết quả cho thấy rõ lợi thế nhà cái
(house edge) luôn dương với mọi loại cược, và không có hệ thống quản lý vốn nào
(Martingale, Fibonacci...) thay đổi được điều đó về lâu dài — chỉ thay đổi
hình dạng phân phối rủi ro/lợi nhuận trong ngắn hạn.
