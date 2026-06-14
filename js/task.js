import { TarefaAPI, ObsAPI, MembroAPI } from "./api.js";
import { requireAuth, loadSidebar, showAlert, clearAlert, setLoading, formatDate, formatDateTime, relativeTime, getQueryParam, } from "./auth.js";
requireAuth();
const projetoId = Number(getQueryParam("projeto"));
const tarefaId = Number(getQueryParam("id"));
if (!projetoId || !tarefaId)
    window.location.href = "dashboard.html";
let tarefa = null;
let observacoes = [];
let membros = [];
let currentUsername = "";
let isLider = false;
let pollingInterval = null;
(async () => {
    const perfil = await loadSidebar("dashboard");
    currentUsername = perfil?.username ?? "";
    try {
        [tarefa, membros] = await Promise.all([
            TarefaAPI.detalhar(projetoId, tarefaId),
            MembroAPI.listar(projetoId),
        ]);
        const me = membros.find((m) => m.usuario.username === currentUsername);
        isLider = me?.papel === "L";
        renderTarefa();
        await loadObservacoes();
        setupUI();
        startPolling();
    }
    catch (err) {
        document.getElementById("task-body").innerHTML =
            `<div class="alert alert-error">${err.message}</div>`;
    }
})();
// ── Polling ───────────────────────────────────────────────────────────────
function startPolling() {
    if (pollingInterval)
        clearInterval(pollingInterval);
    pollingInterval = setInterval(() => loadObservacoes(true), 6000);
}
document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
        if (pollingInterval)
            clearInterval(pollingInterval);
    }
    else
        startPolling();
});
// ── Render tarefa ─────────────────────────────────────────────────────────
function renderTarefa() {
    if (!tarefa)
        return;
    const statusBadge = { P: "badge-gray", E: "badge-blue", C: "badge-green" };
    const statusLabels = { P: "Pendente", E: "Em andamento", C: "Concluída" };
    document.getElementById("task-titulo").textContent = tarefa.titulo;
    document.getElementById("task-descricao").textContent = tarefa.descricao;
    document.getElementById("task-status-badge").innerHTML =
        `<span class="badge ${statusBadge[tarefa.status]}">${statusLabels[tarefa.status]}</span>`;
    const prazoHtml = tarefa.prazo
        ? `<span style="display:flex;align-items:center;gap:4px">
         <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
         Prazo: <strong>${formatDate(tarefa.prazo)}</strong>
       </span>`
        : "";
    const respHtml = tarefa.responsavel
        ? `<span style="display:flex;align-items:center;gap:4px">
         <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
         Responsável: <strong>${tarefa.responsavel.username}</strong>
       </span>`
        : "";
    document.getElementById("task-meta").innerHTML = [
        prazoHtml, respHtml,
        `<span class="text-xs text-muted font-mono">Criado em ${formatDate(tarefa.criado_em)}</span>`,
    ].filter(Boolean).join(" · ");
    const link = document.getElementById("link-projeto");
    if (link)
        link.href = `/project.html?id=${projetoId}`;
    const statusSel = document.getElementById("quick-status");
    if (statusSel) {
        statusSel.value = tarefa.status;
        // Remove listeners antigos clonando o elemento
        const fresh = statusSel.cloneNode(true);
        statusSel.replaceWith(fresh);
        fresh.addEventListener("change", () => quickStatusChange(fresh));
    }
    const actionsEl = document.getElementById("task-actions");
    if (isLider) {
        actionsEl.innerHTML = `
      <button id="btn-edit-task" class="btn btn-secondary btn-sm">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        Editar
      </button>
      <button id="btn-delete-task" class="btn btn-danger btn-sm">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
        Excluir
      </button>`;
        document.getElementById("btn-edit-task")?.addEventListener("click", openEditTask);
        document.getElementById("btn-delete-task")?.addEventListener("click", confirmDeleteTask);
    }
}
async function quickStatusChange(sel) {
    const newStatus = sel.value;
    sel.disabled = true;
    try {
        tarefa = await TarefaAPI.atualizar(projetoId, tarefaId, { status: newStatus });
        renderTarefa();
    }
    catch (err) {
        alert(err.message);
        sel.value = tarefa?.status ?? "P";
    }
    finally {
        sel.disabled = false;
    }
}
// ── Observações ───────────────────────────────────────────────────────────
async function loadObservacoes(silent = false) {
    const el = document.getElementById("obs-list");
    if (!silent)
        el.innerHTML = `<div class="loading-center"><span class="spinner"></span></div>`;
    const novas = await ObsAPI.listar(projetoId, tarefaId);
    if (silent && JSON.stringify(novas) === JSON.stringify(observacoes))
        return;
    observacoes = novas;
    renderObservacoes();
}
function renderObservacoes() {
    const el = document.getElementById("obs-list");
    const countEl = document.getElementById("obs-count");
    if (countEl)
        countEl.textContent = String(observacoes.length);
    if (!observacoes.length) {
        el.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="40" height="40"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
        </div>
        <h3>Nenhuma observação ainda</h3>
        <p>Seja o primeiro a comentar nesta tarefa.</p>
      </div>`;
        return;
    }
    el.innerHTML = observacoes.map((o) => {
        const isAuthor = o.autor.username === currentUsername;
        const canEdit = isAuthor;
        const canDel = isAuthor || isLider;
        const editSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="13" height="13"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
        const delSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="13" height="13"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>`;
        const actions = (canEdit || canDel) ? `
      <div style="display:flex;gap:4px">
        ${canEdit ? `<button class="btn btn-ghost btn-sm btn-edit-obs" data-id="${o.id}" title="Editar">${editSvg}</button>` : ""}
        ${canDel ? `<button class="btn btn-ghost btn-sm btn-del-obs"  data-id="${o.id}" title="Excluir">${delSvg}</button>` : ""}
      </div>` : "";
        return `
      <div class="obs-item">
        <div class="obs-header">
          <div>
            <span class="obs-author">@${o.autor.username}</span>
            <span class="obs-time" title="${formatDateTime(o.criado_em)}">${relativeTime(o.criado_em)}</span>
          </div>
          ${actions}
        </div>
        <div class="obs-text" id="obs-text-${o.id}">${escHtml(o.texto)}</div>
        <div id="obs-edit-${o.id}" class="hidden" style="margin-top:8px">
          <textarea class="form-control" id="obs-edit-area-${o.id}" rows="3">${escHtml(o.texto)}</textarea>
          <div style="display:flex;gap:8px;margin-top:8px">
            <button class="btn btn-primary btn-sm btn-save-obs-edit" data-id="${o.id}">Salvar</button>
            <button class="btn btn-ghost btn-sm btn-cancel-obs-edit" data-id="${o.id}">Cancelar</button>
          </div>
        </div>
      </div>`;
    }).join("");
    el.querySelectorAll(".btn-edit-obs").forEach((btn) => {
        btn.addEventListener("click", () => toggleObsEdit(Number(btn.dataset["id"]), true));
    });
    el.querySelectorAll(".btn-del-obs").forEach((btn) => {
        btn.addEventListener("click", () => {
            if (confirm("Excluir esta observação?"))
                deleteObs(Number(btn.dataset["id"]));
        });
    });
    el.querySelectorAll(".btn-save-obs-edit").forEach((btn) => {
        btn.addEventListener("click", () => saveObsEdit(Number(btn.dataset["id"]), btn));
    });
    el.querySelectorAll(".btn-cancel-obs-edit").forEach((btn) => {
        btn.addEventListener("click", () => toggleObsEdit(Number(btn.dataset["id"]), false));
    });
}
function toggleObsEdit(id, open) {
    document.getElementById(`obs-text-${id}`)?.classList.toggle("hidden", open);
    document.getElementById(`obs-edit-${id}`)?.classList.toggle("hidden", !open);
}
async function saveObsEdit(id, btn) {
    const area = document.getElementById(`obs-edit-area-${id}`);
    const texto = area.value.trim();
    if (!texto) {
        alert("A observação não pode ficar vazia.");
        return;
    }
    setLoading(btn, true, "Salvar");
    try {
        await ObsAPI.atualizar(projetoId, tarefaId, id, texto);
        await loadObservacoes();
    }
    catch (err) {
        alert(err.message);
    }
    finally {
        setLoading(btn, false, "Salvar");
    }
}
async function deleteObs(id) {
    try {
        await ObsAPI.excluir(projetoId, tarefaId, id);
        await loadObservacoes();
    }
    catch (err) {
        alert(err.message);
    }
}
// ── Nova observação ───────────────────────────────────────────────────────
function setupUI() {
    const form = document.getElementById("form-obs");
    const btnSave = document.getElementById("btn-send-obs");
    const textarea = document.getElementById("obs-texto");
    textarea.addEventListener("input", () => {
        textarea.style.height = "auto";
        textarea.style.height = textarea.scrollHeight + "px";
    });
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const texto = textarea.value.trim();
        if (!texto) {
            showAlert("alert-obs", "Escreva algo antes de enviar.");
            return;
        }
        setLoading(btnSave, true, "Enviar");
        try {
            await ObsAPI.criar(projetoId, tarefaId, texto);
            textarea.value = "";
            textarea.style.height = "auto";
            clearAlert("alert-obs");
            await loadObservacoes();
        }
        catch (err) {
            showAlert("alert-obs", err.message);
        }
        finally {
            setLoading(btnSave, false, "Enviar");
        }
    });
}
// ── Editar tarefa ─────────────────────────────────────────────────────────
function openEditTask() {
    if (!tarefa)
        return;
    const sel = document.getElementById("edit-responsavel");
    sel.innerHTML = `<option value="">— Sem responsável —</option>` +
        membros.map((m) => `<option value="${m.usuario.id}">${escHtml(m.usuario.nome_completo)} (@${m.usuario.username})</option>`).join("");
    document.getElementById("edit-titulo").value = tarefa.titulo;
    document.getElementById("edit-descricao").value = tarefa.descricao;
    document.getElementById("edit-status").value = tarefa.status;
    document.getElementById("edit-prazo").value = tarefa.prazo ?? "";
    sel.value = String(tarefa.responsavel?.id ?? "");
    clearAlert("alert-edit-task");
    document.getElementById("modal-edit-task").classList.remove("hidden");
}
document.getElementById("btn-close-edit-task")?.addEventListener("click", () => {
    document.getElementById("modal-edit-task").classList.add("hidden");
});
document.getElementById("form-edit-task")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("btn-save-edit-task");
    const titulo = document.getElementById("edit-titulo").value.trim();
    const descricao = document.getElementById("edit-descricao").value.trim();
    const status = document.getElementById("edit-status").value;
    const prazo = document.getElementById("edit-prazo").value || null;
    const respIdStr = document.getElementById("edit-responsavel").value;
    const responsavel_id = respIdStr ? Number(respIdStr) : null;
    if (!titulo || !descricao) {
        showAlert("alert-edit-task", "Preencha título e descrição.");
        return;
    }
    setLoading(btn, true, "Salvar");
    try {
        tarefa = await TarefaAPI.atualizar(projetoId, tarefaId, { titulo, descricao, status, prazo, responsavel_id });
        document.getElementById("modal-edit-task").classList.add("hidden");
        renderTarefa();
    }
    catch (err) {
        showAlert("alert-edit-task", err.message);
    }
    finally {
        setLoading(btn, false, "Salvar");
    }
});
async function confirmDeleteTask() {
    if (!confirm(`Excluir a tarefa "${tarefa?.titulo}"?`))
        return;
    try {
        await TarefaAPI.excluir(projetoId, tarefaId);
        window.location.href = `/project.html?id=${projetoId}`;
    }
    catch (err) {
        alert(err.message);
    }
}
// ── Utilitário ────────────────────────────────────────────────────────────
function escHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
