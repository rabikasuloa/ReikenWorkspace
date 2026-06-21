/**
 * REIKEN AUTH
 * Lógica de inicio de sesión y registro.
 */

(function initAuth() {
  const loginForm    = document.querySelector(".login-form");
  const registerForm = document.querySelector(".register-form");

  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn   = loginForm.querySelector("button[type='submit']");
      const email = loginForm.querySelector("input[type='email']").value.trim();
      const pass  = loginForm.querySelector("input[type='password']").value;

      btn.disabled    = true;
      btn.textContent = "Entrando...";

      const { error } = await supabaseClient.auth.signInWithPassword({ email, password: pass });

      if (error) {
        showToast("✖ " + error.message, "error");
        btn.disabled    = false;
        btn.textContent = "¡HECHO!";
        return;
      }

      window.location.href = "projects.html";
    });
  }

  if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn      = registerForm.querySelector("button[type='submit']");
      const inputs   = registerForm.querySelectorAll("input");
      const username = inputs[0].value.trim();
      const email    = inputs[1].value.trim();
      const pass     = inputs[2].value;
      const passConf = inputs[3].value;

      if (pass !== passConf) {
        showToast("✖ Las contraseñas no coinciden", "error");
        return;
      }

      btn.disabled    = true;
      btn.textContent = "Registrando...";

      const { data, error } = await supabaseClient.auth.signUp({ email, password: pass });

      if (error) {
        showToast("✖ " + error.message, "error");
        btn.disabled    = false;
        btn.textContent = "¡HECHO!";
        return;
      }

      const uid = data.user?.id;
      if (uid) {
        await supabaseClient.from("usuarios").insert({
          id:       uid,
          email:    email,
          username: username,
          alias:    username // Default alias
        });
      }

      showToast("✔ Cuenta creada. Redirigiendo...");
      setTimeout(() => window.location.href = "personalization.html", 1500);
    });
  }
})();
