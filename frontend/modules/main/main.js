(function () {
    async function checkServer() {
        const status = document.getElementById("status");
        if (!status) return;

        try {
            const res = await fetch(`${window.APP.getApiBase()}/`);
            if (!res.ok) throw new Error("server error");
            status.textContent = "Server is running";
            status.className = "status-pill ok";
        } catch {
            status.textContent = "Server is DOWN";
            status.className = "status-pill down";
        }
    }

    document.addEventListener("DOMContentLoaded", checkServer);
})();
