import { TokenStore, AuthAPI, ConviteAPI } from "./api.js";
import type { Perfil } from "./api.js";

export function requireAuth(): void {
  if (!TokenStore.isLogged()) window.location.href = "index.html";
}

export function requireGuest(): void {
  if (TokenStore.isLogged()) window.location.href = "dashboard.html";
}

export function getQueryParam(name: string): string | null {
  return new URLSearchParams(window.location.search).get(name);
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "agora mesmo";
  if (mins < 60) return `ha ${mins}min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `ha ${hrs}h`;
  return `ha ${Math.floor(hrs / 24)}d`;
}

export function showAlert(
  containerId: string,
  msg: string,
  type: "error" | "success" | "info" | "warning" = "error"
): void {
  const el = document.getElementById(containerId);
  if (el) el.innerHTML = `<div class="alert alert-${type}" role="alert">${msg}</div>`;
}

export function clearAlert(containerId: string): void {
  const el = document.getElementById(containerId);
  if (el) el.innerHTML = "";
}

export function setLoading(btn: HTMLButtonElement, loading: boolean, label = "Salvar"): void {
  if (loading) {
    btn.disabled = true;
    btn.dataset["original"] = btn.innerHTML;
    btn.innerHTML = `<span class="spinner" style="width:16px;height:16px;border-width:2px"></span>`;
  } else {
    btn.disabled = false;
    btn.innerHTML = btn.dataset["original"] ?? label;
  }
}

export function openModal(id: string): void {
  document.getElementById(id)?.classList.remove("hidden");
}

export function closeModal(id: string): void {
  document.getElementById(id)?.classList.add("hidden");
}

export function bindModalClose(overlayId: string): void {
  const overlay = document.getElementById(overlayId);
  overlay?.addEventListener("click", (e) => {
    if (e.target === overlay) closeModal(overlayId);
  });
}

export function iniciais(nome: string): string {
  return nome.split(" ").filter(Boolean).slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "").join("");
}

export function setSidebarActive(key: string): void {
  document.querySelectorAll<HTMLElement>(".nav-link[data-nav-key]").forEach((el) => {
    el.classList.toggle("active", el.dataset["navKey"] === key);
  });
}

const ICONS = {
  grid: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`,
  mail: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>`,
  user: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  logout: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>`,
};

export async function loadSidebar(activePage: string): Promise<Perfil | null> {
  const root = document.getElementById("sidebar-root");
  if (!root) return null;

  let pendingCount = 0;
  try {
    const invites = await ConviteAPI.meus();
    pendingCount = invites.filter((c) => c.status === "P").length;
  } catch { /* silencioso */ }

  let perfil: Perfil | null = null;
  try {
    perfil = await AuthAPI.getPerfil();
    localStorage.setItem("current_user", JSON.stringify(perfil));
  } catch {
    const cached = localStorage.getItem("current_user");
    if (cached) perfil = JSON.parse(cached) as Perfil;
  }

  const nomeCompleto = perfil ? `${perfil.nome} ${perfil.sobrenome}` : "Usuario";
  const matricula = perfil?.matricula ?? "";

  const navLinks = [
    { href: "/dashboard.html",          key: "dashboard", icon: ICONS.grid, label: "Projetos" },
    { href: "/dashboard.html#convites", key: "convites",  icon: ICONS.mail, label: "Convites",
      badge: pendingCount > 0 ? pendingCount : undefined },
    { href: "/profile.html",            key: "profile",   icon: ICONS.user, label: "Perfil" },
  ];

  root.innerHTML = `
    <div class="sidebar-logo">
      <div class="logo-mark">
        <div class="logo-text">Gerencie seus projetos</div>
      </div>
    </div>

    <div class="sidebar-user">
      <div class="user-info">
        <div>
          <div class="user-name">${nomeCompleto}</div>
          <div class="user-role font-mono">${matricula}</div>
        </div>
      </div>
    </div>

    <nav class="sidebar-nav">
      <div class="nav-section">
        <div class="nav-label">Menu</div>
        ${navLinks.map((l) => `
          <a href="${l.href}"
             class="nav-link ${l.key === activePage ? "active" : ""}"
             data-nav-key="${l.key}">
            ${l.icon}
            <span>${l.label}</span>
            ${l.badge ? `<span class="badge badge-gold" style="margin-left:auto">${l.badge}</span>` : ""}
          </a>`).join("")}
      </div>
    </nav>

    <div class="sidebar-footer">
      <button id="btn-logout" class="nav-link btn-ghost" style="width:100%">
        ${ICONS.logout}
        Sair
      </button>
    </div>`;

  document.getElementById("btn-logout")?.addEventListener("click", async () => {
    await AuthAPI.logout();
    window.location.href = "index.html";
  });

  return perfil;
}