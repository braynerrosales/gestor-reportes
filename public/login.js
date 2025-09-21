document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("loginForm");
  const loginError = document.getElementById("loginError");
  const themeToggle = document.getElementById("themeToggle");

  // manejar login
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const username = document.getElementById("username").value.trim();
      const password = document.getElementById("password").value.trim();

      try {
        const res = await fetch("/api/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password })
        });

        if (!res.ok) {
          loginError.textContent = "Usuario o contraseña incorrectos";
          return;
        }

        const data = await res.json();
        localStorage.setItem("token", data.token);
        window.location.href = "/app.html"; // redirige a la app
      } catch (err) {
        loginError.textContent = "Error en el servidor";
      }
    });
  }

  // tema guardado
  const savedTheme = localStorage.getItem("theme") || "dark";
  applyTheme(savedTheme);

  themeToggle.addEventListener("click", () => {
    const newTheme = document.body.classList.contains("light") ? "dark" : "light";
    applyTheme(newTheme);
  });

  function applyTheme(theme) {
    if (theme === "light") {
      document.body.classList.add("light");
      themeToggle.textContent = "🌞";
    } else {
      document.body.classList.remove("light");
      themeToggle.textContent = "🌙";
    }
    localStorage.setItem("theme", theme);
  }
});
