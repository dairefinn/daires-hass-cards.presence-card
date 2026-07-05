class PresenceCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  setConfig(config) {
    if (!config.entity && !config.entities) {
      throw new Error("You must define 'entity' or 'entities'");
    }
    this._config = config;
    this._render();
  }

  getCardSize() {
    return Math.max(2, this._getEntities().length + 1);
  }

  _getEntities() {
    const c = this._config;
    if (c.entities) return c.entities.map((e) => (typeof e === "string" ? { entity: e } : e));
    return [{ entity: c.entity, name: c.name }];
  }

  _getPersonData(def) {
    const state = this._hass?.states[def.entity];
    const raw = state?.state ?? "unknown";
    const name =
      def.name ||
      state?.attributes?.friendly_name ||
      def.entity.split(".").pop().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    const isHome = raw === "home";
    const isUnknown = raw === "unknown" || raw === "unavailable";

    let label, color;
    if (isUnknown) {
      label = "Unknown";
      color = "var(--secondary-text-color, #727272)";
    } else if (isHome) {
      label = "Home";
      color = "#4caf50";
    } else {
      label = raw.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      color = "var(--secondary-text-color, #727272)";
    }

    const initials = name
      .trim()
      .split(/\s+/)
      .map((w) => w[0] || "")
      .join("")
      .toUpperCase()
      .slice(0, 2) || "?";

    const picture = state?.attributes?.entity_picture;

    return { name, label, color, initials, isHome, picture, entityId: def.entity };
  }

  _avatarHtml(p, size) {
    const border = `2px solid ${p.color}`;
    const style = `width:${size}px;height:${size}px;border:${border};`;
    if (p.picture) {
      return `<div class="avatar" style="${style}"><img src="${p.picture}" alt="${p.initials}" /></div>`;
    }
    const bg = p.isHome ? "#e8f5e9" : "var(--divider-color, #e0e0e0)";
    const fs = Math.round(size * 0.38);
    return `<div class="avatar" style="${style}background:${bg};color:${p.color};font-size:${fs}px;">${p.initials}</div>`;
  }

  _primaryEntity() {
    const e = this._getEntities()[0];
    return (typeof e === "string" ? e : e?.entity) ?? null;
  }

  _handleInteraction(trigger, entityOverride) {
    const interaction = (this._config.interactions ?? []).find(
      (i) => (i.trigger ?? "tap") === trigger
    );
    if (!interaction) return;
    const { action } = interaction;
    if (action === "more-info") {
      const entityId = interaction.entity ?? entityOverride ?? this._primaryEntity();
      if (!entityId) return;
      this.dispatchEvent(new CustomEvent("hass-more-info", {
        detail: { entityId },
        bubbles: true,
        composed: true,
      }));
    } else if (action === "toggle") {
      const entityId = interaction.entity ?? entityOverride ?? this._primaryEntity();
      if (!entityId || !this._hass) return;
      this._hass.callService("homeassistant", "toggle", { entity_id: entityId });
    } else if (action === "call-service") {
      if (!interaction.service || !this._hass) return;
      const [domain, service] = interaction.service.split(".");
      this._hass.callService(domain, service, interaction.service_data ?? {});
    } else if (action === "navigate") {
      if (!interaction.path) return;
      try { window.history.pushState(null, "", interaction.path); } catch (_) {}
      this.dispatchEvent(new CustomEvent("location-changed", { bubbles: true, composed: true }));
    } else if (action === "url") {
      if (!interaction.url) return;
      window.open(interaction.url, interaction.target ?? "_blank");
    }
  }

  _attachTriggers(target, entityOverride) {
    const interactions = this._config?.interactions ?? [];
    const triggers = new Set(interactions.map((i) => i.trigger ?? "tap"));
    target.style.cursor = "pointer";

    if (triggers.has("tap") || triggers.has("double_tap")) {
      let tapCount = 0;
      let tapTimer = null;
      target.addEventListener("click", (e) => {
        if (e.target.closest("button")) return;
        tapCount++;
        if (tapCount === 1) {
          tapTimer = setTimeout(() => {
            tapCount = 0;
            tapTimer = null;
            this._handleInteraction("tap", entityOverride);
          }, 250);
        } else {
          clearTimeout(tapTimer);
          tapTimer = null;
          tapCount = 0;
          this._handleInteraction("double_tap", entityOverride);
        }
      });
    }

    if (triggers.has("hold")) {
      let holdTimer;
      const startHold = () => { holdTimer = setTimeout(() => this._handleInteraction("hold", entityOverride), 500); };
      const cancelHold = () => clearTimeout(holdTimer);
      target.addEventListener("mousedown", startHold);
      target.addEventListener("mouseup", cancelHold);
      target.addEventListener("mouseleave", cancelHold);
      target.addEventListener("touchstart", startHold, { passive: true });
      target.addEventListener("touchend", cancelHold);
      target.addEventListener("touchcancel", cancelHold);
    }
  }

  _attachInteractionListeners() {
    const interactions = this._config?.interactions;
    if (!interactions?.length) return;

    const entities = this._getEntities();
    if (entities.length > 1) {
      this.shadowRoot.querySelectorAll(".row[data-entity]").forEach((row) => {
        row.classList.add("row-interactive");
        this._attachTriggers(row, row.dataset.entity);
      });
    } else {
      const card = this.shadowRoot.querySelector(".card");
      if (card) this._attachTriggers(card, null);
    }
  }

  static getConfigElement() {
    return document.createElement("daires-hass-cards-presence-card-editor");
  }

  static getStubConfig() {
    return { entities: [] };
  }

  _render() {
    if (!this._config) return;

    const config = this._config;
    const entities = this._getEntities();
    const people = entities.map((e) => this._getPersonData(e));
    const background = config.background ?? "var(--card-background-color, #fff)";
    const isSingle = people.length === 1;
    const homeCount = people.filter((p) => p.isHome).length;

    let bodyHtml;

    if (isSingle) {
      const p = people[0];
      bodyHtml = `
        <div class="single">
          ${this._avatarHtml(p, 72)}
          <div class="single-name">${p.name}</div>
          <div class="single-status" style="color:${p.color}">
            <span class="dot" style="background:${p.color}"></span>${p.label}
          </div>
        </div>
      `;
    } else {
      const rows = people
        .map(
          (p) => `
          <div class="row" data-entity="${p.entityId}">
            ${this._avatarHtml(p, 40)}
            <div class="row-info">
              <div class="row-name">${p.name}</div>
              <div class="row-status" style="color:${p.color}">
                <span class="dot" style="background:${p.color}"></span>${p.label}
              </div>
            </div>
          </div>
        `
        )
        .join("");
      bodyHtml = `<div class="list">${rows}</div>`;
    }

    const showHeader = config.title || people.length > 1;

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; height: 100%; }
        ha-card { display: block; height: 100%; }
        .card {
          background: ${background};
          border-radius: 12px;
          padding: 16px;
          box-sizing: border-box;
          height: 100%;
        }
        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
        }
        .title {
          font-size: 14px;
          font-weight: 500;
          color: var(--secondary-text-color, #727272);
        }
        .summary {
          font-size: 13px;
          color: var(--secondary-text-color, #727272);
        }
        .avatar {
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          flex-shrink: 0;
          overflow: hidden;
          box-sizing: border-box;
        }
        .avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          border-radius: 50%;
        }
        .dot {
          display: inline-block;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          margin-right: 5px;
          vertical-align: middle;
          flex-shrink: 0;
        }
        /* Single layout */
        .single {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          padding: 8px 0;
        }
        .single-name {
          font-size: 22px;
          font-weight: 600;
          color: var(--primary-text-color, #212121);
        }
        .single-status {
          font-size: 13px;
          display: flex;
          align-items: center;
        }
        /* List layout */
        .list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .row {
          display: flex;
          align-items: center;
          gap: 12px;
          border-radius: 8px;
        }
        .row-interactive {
          padding: 4px 8px;
          margin: -4px -8px;
          transition: background 0.15s;
        }
        .row-interactive:hover {
          background: var(--divider-color, #e0e0e0);
        }
        .row-info { flex: 1; min-width: 0; }
        .row-name {
          font-size: 14px;
          font-weight: 500;
          color: var(--primary-text-color, #212121);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .row-status {
          font-size: 13px;
          display: flex;
          align-items: center;
          margin-top: 2px;
        }
      </style>
      <ha-card>
        <div class="card">
          ${showHeader ? `
            <div class="header">
              <div class="title">${config.title ?? "Presence"}</div>
              ${people.length > 1 ? `<div class="summary">${homeCount} of ${people.length} home</div>` : ""}
            </div>
          ` : ""}
          ${bodyHtml}
        </div>
      </ha-card>
    `;
    this._attachInteractionListeners();
  }
}

customElements.define("daires-hass-cards-presence-card", PresenceCard);

class PresenceCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  set hass(hass) {
    this._hass = hass;
    this.shadowRoot.querySelectorAll("ha-entity-picker").forEach((p) => { p.hass = hass; });
  }

  setConfig(config) {
    const c = { ...config };
    if (c.entity !== undefined && !c.entities) {
      c.entities = [{ entity: c.entity, ...(c.name ? { name: c.name } : {}) }];
      delete c.entity;
      delete c.name;
    } else if (!c.entities) {
      c.entities = [];
    }
    this._config = c;
    this._render();
  }

  _fire() {
    this.dispatchEvent(new CustomEvent("config-changed", {
      detail: { config: { ...this._config } },
      bubbles: true,
      composed: true,
    }));
  }

  _setField(key, value) {
    if (value === "" || value === undefined) {
      delete this._config[key];
    } else {
      this._config[key] = value;
    }
    this._fire();
  }

  _updateEntity(i, field, value) {
    const entities = this._config.entities.map((e) => ({ ...e }));
    if (value) {
      entities[i][field] = value;
    } else {
      delete entities[i][field];
    }
    this._config = { ...this._config, entities };
    this._fire();
  }

  _addEntity() {
    this._config = { ...this._config, entities: [...this._config.entities, { entity: "" }] };
    this._renderList();
    this._fire();
  }

  _removeEntity(i) {
    const entities = this._config.entities.filter((_, idx) => idx !== i);
    this._config = { ...this._config, entities };
    this._renderList();
    this._fire();
  }

  _renderList() {
    const entities = this._config.entities ?? [];
    const list = this.shadowRoot.getElementById("entities-list");
    if (!list) return;

    list.innerHTML = entities.map((e, i) => `
      <div class="entity-row">
        <div class="picker-wrap"><ha-entity-picker data-index="${i}"></ha-entity-picker></div>
        <input class="name-input" type="text" data-index="${i}" placeholder="Name (optional)" />
        <button class="remove-btn" data-index="${i}" type="button">✕</button>
      </div>
    `).join("");

    list.querySelectorAll("ha-entity-picker").forEach((picker) => {
      const i = parseInt(picker.dataset.index);
      picker.value = entities[i]?.entity ?? "";
      picker.includeDomains = ["person", "device_tracker"];
      if (this._hass) picker.hass = this._hass;
      picker.addEventListener("value-changed", (e) => this._updateEntity(i, "entity", e.detail.value));
    });

    list.querySelectorAll(".name-input").forEach((input) => {
      const i = parseInt(input.dataset.index);
      input.value = entities[i]?.name ?? "";
      input.addEventListener("change", (e) => this._updateEntity(i, "name", e.target.value));
    });

    list.querySelectorAll(".remove-btn").forEach((btn) => {
      const i = parseInt(btn.dataset.index);
      btn.addEventListener("click", () => this._removeEntity(i));
    });
  }

  _render() {
    const c = this._config ?? {};
    this.shadowRoot.innerHTML = `
      <style>
        .form { display: flex; flex-direction: column; gap: 12px; padding: 16px 0; }
        .section { font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--secondary-text-color, #727272); padding-bottom: 4px; border-bottom: 1px solid var(--divider-color, #e0e0e0); margin-top: 8px; }
        .row { display: flex; flex-direction: column; gap: 4px; }
        label { font-size: 12px; color: var(--secondary-text-color, #727272); }
        input[type=text] { padding: 8px 10px; border: 1px solid var(--divider-color, #e0e0e0); border-radius: 6px; font-size: 14px; color: var(--primary-text-color, #212121); background: var(--card-background-color, #fff); box-sizing: border-box; width: 100%; }
        ha-entity-picker { display: block; }
        .entity-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
        .picker-wrap { flex: 2; min-width: 0; }
        .name-input { flex: 1; min-width: 0; }
        .remove-btn { background: none; border: none; cursor: pointer; color: var(--secondary-text-color, #727272); font-size: 18px; padding: 4px 8px; border-radius: 4px; flex-shrink: 0; line-height: 1; }
        .remove-btn:hover { background: var(--divider-color, #e0e0e0); }
        .add-btn { display: flex; align-items: center; justify-content: center; background: none; border: 1px dashed var(--divider-color, #e0e0e0); border-radius: 6px; padding: 10px; cursor: pointer; font-size: 13px; color: var(--primary-color, #03a9f4); width: 100%; box-sizing: border-box; }
        .add-btn:hover { background: var(--divider-color, #e0e0e0); }
      </style>
      <div class="form">
        <div class="section">People</div>
        <div id="entities-list"></div>
        <button class="add-btn" id="add-btn" type="button">+ Add person</button>

        <div class="section">Display</div>
        <div class="row"><label>Title</label><input id="title" type="text" placeholder="Presence" /></div>
      </div>
    `;

    this._renderList();

    const titleEl = this.shadowRoot.getElementById("title");
    titleEl.value = c.title ?? "";
    titleEl.addEventListener("change", (e) => this._setField("title", e.target.value));

    this.shadowRoot.getElementById("add-btn").addEventListener("click", () => this._addEntity());
  }
}

customElements.define("daires-hass-cards-presence-card-editor", PresenceCardEditor);
