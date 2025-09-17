## 前置
1. Firebase Console → Authentication → Sign-in method → 啟用 Anonymous。
2. Authentication → Settings → Authorized domains → 加入 `<你的 GitHub 帳號>.github.io`。
3. Firestore → 建立資料庫 → 載入 `firebase.rules`。
4. 專案設定 → 保留本 repo 內的 `firebaseConfig`（或自行換成你的）。

## 部署
- 把本目錄推到 GitHub，開啟 GitHub Pages：Source 指向 `main` 分支的 `/public`。
- 造訪 `https://<你的帳號>.github.io/<repo>/`。

## 使用
- 首次載入會匿名登入並自動建立 4 間預設房（ensureDefaultRooms）。
- 在大廳點「加入房間」，輸入暱稱，準備、開始、翻牌皆以 Firestore 同步。
