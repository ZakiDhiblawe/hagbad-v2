# Frontend

Simple static frontend using HTML, CSS, and JavaScript.

## Run Frontend

```bash
python3 -m http.server 3000

Open:

http://localhost:3000
How It Works
Uses fetch() to call backend API
Backend runs on port 8000
Pages
index.html (main)
login.html
register.html
dashboard.html

---

# 📄 5. FRONTEND STRUCTURE (`frontend/STRUCTURE.md`)

```md
# Frontend Structure


frontend/
├── index.html
├── css/
│ └── style.css
├── js/
│ └── app.js
├── pages/
│ ├── login.html
│ ├── register.html
│ └── dashboard.html
└── modules/
├── main/
│ └── main.js
└── user/
├── user.js
└── user_api.js


## Notes

- `modules/` matches backend modules
- `user_api.js` handles API calls
- `user.js` handles UI logic
