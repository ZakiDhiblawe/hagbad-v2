export default function NotFoundPage({ navigate }) {
  return (
    <main className="hero-shell">
      <div className="container py-5">
        <section className="dashboard-panel card">
          <div className="card-body">
            <span className="eyebrow">Not found</span>
            <h1>This route does not exist in the React frontend.</h1>
            <p>The browser path is valid, but this React app has not mapped it yet.</p>
            <button className="btn portal-btn-primary" type="button" onClick={() => navigate("/")}>
              Go home
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
