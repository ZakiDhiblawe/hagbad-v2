function checkServer() {
    const status = document.getElementById("status");

    fetch("http://localhost:8000/")
        .then(res => {
            if (!res.ok) throw new Error();
            return res.json();
        })
        .then(() => {
            status.textContent = "Server is running";
            status.className = "status success";
        })
        .catch(() => {
            status.textContent = "Server is DOWN";
            status.className = "status error";
        });
}

checkServer();