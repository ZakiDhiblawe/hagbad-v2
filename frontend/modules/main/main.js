(function () {
    async function checkServer() {
        const status = document.getElementById("status");
        if (!status) return;

        try {
            const res = await fetch(`${window.APP.getApiBase()}/`);
            if (!res.ok) throw new Error("server error");
            status.textContent = "Backend connected";
            status.className = "status-chip status-ok";
        } catch {
            status.textContent = "Backend unavailable";
            status.className = "status-chip status-down";
        }
    }

    document.addEventListener("DOMContentLoaded", () => {
        if (window.APP.isAuthed()) {
            window.APP.navigate("pages/dashboard.html");
            return;
        }

        checkServer();
    });
})();
