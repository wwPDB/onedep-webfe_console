(function () {
  var API = "/service/workmanager";
  var STORAGE = "onedep-console-session";

  var MESSAGE_TEMPLATES = [
    { id: "cmps_default", label: "Default" },
    { id: "cmps_vldtn", label: "Validation Report" },
    { id: "cmps_approval-expl", label: "Approval Explicit" },
    { id: "cmps_approval-impl", label: "Approval Implicit" },
    { id: "cmps_reminder", label: "Reminder" },
    { id: "cmps_extension-3mo", label: "Extension 3 months" },
    { id: "cmps_extension-6mo", label: "Extension 6 months" },
    { id: "cmps_release-publ", label: "Release w/ Publication" },
    { id: "cmps_release-nopubl", label: "Release w/o Publication" },
    { id: "cmps_system-unlocked", label: "System Unlocked" },
    { id: "cmps_withdrawn", label: "Withdrawn" }
  ];

  var LEVEL2_MODULES = [
    { id: "reportmod", label: "ReportMod", has_run_ui: false },
    { id: "transmod", label: "TransMod", has_run_ui: true },
    { id: "ligmod", label: "LigMod", has_run_ui: true },
    { id: "seqmod", label: "SeqMod", has_run_ui: true },
    { id: "annmod", label: "AnnMod", has_run_ui: true },
    { id: "valmod", label: "ValMod", has_run_ui: false },
    { id: "reportmod2", label: "ReportMod2", has_run_ui: false },
    { id: "statmod", label: "StatMod", has_run_ui: false }
  ];

  var GROUPS = [
    {
      slug: "general",
      title: "General",
      navTitle: "General",
      blurb: "Work Manager actions that are not tied to a specific module.",
      actions: [
        {
          id: "add_to_my_todo",
          title: "Add to my TO DO",
          description: "Adds each deposition ID to your Work Manager To Do list.",
          implemented: true
        },
        {
          id: "remove_from_my_todo",
          title: "Remove from my TO DO",
          description: "Removes each deposition ID from the To Do list.",
          implemented: true
        }
      ]
    },
    {
      slug: "annotation-module",
      title: "Annotation Module",
      navTitle: "Annotation",
      blurb: "Open AnnMod and Finish, or assign all monomers then Finish.",
      actions: [
        {
          id: "annmod_finish",
          title: "Open AnnMod and Finish",
          description: "Opens waiting AnnMod for each ID, then Finish. Skips IDs that are not waiting at AnnMod.",
          implemented: true
        },
        {
          id: "annmod_assign_all_monomers",
          title: "Open AnnMod, assign all monomers, and Finish",
          description: "Opens waiting AnnMod, assigns all monomer assemblies, then Finish in that session.",
          implemented: true
        }
      ]
    },
    {
      slug: "send-template-message",
      title: "Communication Module",
      navTitle: "Communication",
      blurb: "Letters and notes sent as you.",
      actions: [
        {
          id: "send_template_message",
          title: "Send template message",
          description: "Sends the chosen Communication template as you.",
          implemented: true
        },
        {
          id: "add_internal_note",
          title: "Add internal note",
          description: "Writes a notes-from-annotator CIF note. No depositor email.",
          implemented: true
        },
        {
          id: "set_internal_notes_flag",
          title: "Enable or disable internal notes",
          description: "Sets NOTES_FLAGGING_STATUS (the WFM star). Skips IDs already in that state.",
          implemented: true
        },
        { id: "unlock_depui", title: "Unlock DepUI", description: "Stays on Playwright for now.", implemented: false }
      ]
    },
    {
      slug: "deposition-interface",
      title: "Deposition Interface",
      navTitle: "DepUI",
      blurb: "Complete DepUI and submit stays on Playwright.",
      actions: [
        { id: "complete_depui_submission", title: "Complete DepUI and submit", description: "Deferred.", implemented: false }
      ]
    },
    {
      slug: "level-2",
      title: "Level 2",
      navTitle: "Level 2",
      blurb: "Queue Run, Run+UI, or Restart on the workflow engine.",
      actions: [
        {
          id: "run_or_restart_level2_module",
          title: "Run or Restart a module",
          description: "Queues restartGoWF for each ID. Does not wait for the module to finish.",
          implemented: true
        }
      ]
    },
    {
      slug: "status-change",
      title: "Status Module",
      navTitle: "Status",
      blurb: "AUTH, hold date, and reload.",
      actions: [
        {
          id: "extend_hold_date",
          title: "Extend hold date",
          description: "Sets hold to deposit date + 12 months + 3 or 6. Optional extension letter.",
          implemented: true
        },
        {
          id: "reload_data_file",
          title: "Reload data file",
          description: "Reloads status from the current archive model. No new version.",
          implemented: true
        },
        {
          id: "set_auth_validation_letter",
          title: "Set to AUTH and send Validation Letter",
          description: "Sets AUTH (approval unassigned). Letter is optional; uncheck to AUTH only.",
          implemented: true
        }
      ]
    }
  ];

  var session = null;
  var navContext = "home";
  var views = {
    login: document.getElementById("view-login"),
    hub: document.getElementById("view-hub"),
    action: document.getElementById("view-action"),
    job: document.getElementById("view-job")
  };

  function $(id) {
    return document.getElementById(id);
  }

  function showError(el, msg) {
    if (!el) return;
    el.textContent = msg || "";
    if (el.id === "login-error") return;
    if (!msg) el.classList.add("hidden");
    else el.classList.remove("hidden");
  }

  function setSheet(id, enabled) {
    var el = $(id);
    if (el) el.disabled = !enabled;
  }

  function showView(name) {
    var isLogin = name === "login";
    document.documentElement.classList.toggle("page-login", isLogin);
    document.documentElement.classList.toggle("page-app", !isLogin);
    setSheet("wfm-login-css", isLogin);
    setSheet("bs-css", !isLogin);
    setSheet("app-fonts-css", !isLogin);
    setSheet("app-styles-css", !isLogin);
    document.title = isLogin ? "Login Page" : "Console";
    $("app-shell").classList.toggle("hidden", isLogin);
    views.login.classList.toggle("hidden", !isLogin);
    Object.keys(views).forEach(function (key) {
      if (key === "login") return;
      views[key].classList.toggle("hidden", key !== name);
    });
  }

  function loadSession() {
    try {
      return JSON.parse(sessionStorage.getItem(STORAGE) || "null");
    } catch (e) {
      return null;
    }
  }

  function saveSession(data) {
    session = data;
    sessionStorage.setItem(STORAGE, JSON.stringify(data));
  }

  function clearSession() {
    session = null;
    sessionStorage.removeItem(STORAGE);
  }

  function post(path, fields) {
    var body = new URLSearchParams();
    if (session && session.sessionid) body.set("sessionid", session.sessionid);
    if (session && session.annotator) body.set("annotator", session.annotator);
    Object.keys(fields || {}).forEach(function (key) {
      if (fields[key] !== undefined && fields[key] !== null) body.set(key, fields[key]);
    });
    return fetch(API + path, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body: body.toString()
    }).then(function (res) {
      return res.text().then(function (text) {
        var data;
        try {
          data = JSON.parse(text);
        } catch (e) {
          throw new Error("Console service did not return JSON.");
        }
        if (!res.ok || data.errorflag) {
          throw new Error(data.errortext || data.statustext || "Request failed.");
        }
        return data;
      });
    });
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function groupLive(group) {
    return group.actions.some(function (act) {
      return act.implemented;
    });
  }

  function findGroup(slug) {
    for (var i = 0; i < GROUPS.length; i++) {
      if (GROUPS[i].slug === slug) return GROUPS[i];
    }
    return null;
  }

  function findAction(actionId) {
    for (var i = 0; i < GROUPS.length; i++) {
      for (var j = 0; j < GROUPS[i].actions.length; j++) {
        if (GROUPS[i].actions[j].id === actionId) {
          return { group: GROUPS[i], action: GROUPS[i].actions[j] };
        }
      }
    }
    return null;
  }

  function setPageHeader(subtitle) {
    $("page-subheading").textContent = subtitle || "";
  }

  function setActiveNav(slug) {
    var items = document.querySelectorAll("#top-menu-options li");
    for (var i = 0; i < items.length; i++) {
      var link = items[i].querySelector("a");
      var nav = link ? link.getAttribute("data-nav") : "";
      items[i].classList.toggle("active", nav === slug);
    }
  }

  function renderHeader() {
    var nameEl = $("header-name");
    var idEl = $("span_identifier");
    if (!session) {
      nameEl.textContent = "";
      idEl.textContent = "";
      return;
    }
    nameEl.textContent =
      (session.first_name || "") + " " + (session.last_name || "") + " · " + session.annotator;
    idEl.textContent = session.annotator;
  }

  function renderNav() {
    var ul = $("top-menu-options");
    ul.innerHTML = "";
    var home = document.createElement("li");
    home.innerHTML = '<a href="#/" data-nav="home">Home</a>';
    ul.appendChild(home);
    GROUPS.forEach(function (group) {
      var li = document.createElement("li");
      if (!groupLive(group)) li.className = "disabled";
      li.innerHTML =
        '<a href="#/' +
        group.slug +
        '" data-nav="' +
        group.slug +
        '">' +
        escapeHtml(group.navTitle || group.title) +
        "</a>";
      ul.appendChild(li);
    });
  }

  function actionListHtml(group) {
    var html = '<div class="list-group">';
    group.actions.forEach(function (act) {
      if (act.implemented) {
        html +=
          '<a href="#/" class="list-group-item" data-action="' +
          act.id +
          '"><strong>' +
          escapeHtml(act.title) +
          '</strong><span class="action-card__desc">' +
          escapeHtml(act.description) +
          "</span></a>";
      } else {
        html +=
          '<div class="list-group-item disabled" title="Not available yet"><strong>' +
          escapeHtml(act.title) +
          '</strong><span class="action-card__desc">Not available yet. ' +
          escapeHtml(act.description) +
          "</span></div>";
      }
    });
    html += "</div>";
    return html;
  }

  function bindActionLinks(root) {
    root.querySelectorAll("[data-action]").forEach(function (el) {
      el.addEventListener("click", function (ev) {
        ev.preventDefault();
        openAction(el.getAttribute("data-action"));
      });
    });
  }

  function renderHub() {
    navContext = "home";
    setPageHeader("All actions");
    setActiveNav("home");
    var html = "<p>Choose an action, or open a group from the black bar. Greyed-out items are not available yet.</p>";
    GROUPS.forEach(function (group) {
      html += '<div class="panel panel-default">';
      html += '<div class="panel-heading"><h4 class="panel-title">' + escapeHtml(group.title) + "</h4></div>";
      html += '<div class="panel-body"><p class="text-muted">' + escapeHtml(group.blurb) + "</p>";
      html += actionListHtml(group);
      html += "</div></div>";
    });
    views.hub.innerHTML = html;
    bindActionLinks(views.hub);
    showView("hub");
  }

  function renderGroup(slug) {
    var group = findGroup(slug);
    if (!group) {
      renderHub();
      return;
    }
    navContext = slug;
    setPageHeader(group.title);
    setActiveNav(slug);
    var html = "<p>" + escapeHtml(group.blurb) + "</p>";
    html += actionListHtml(group);
    views.hub.innerHTML = html;
    bindActionLinks(views.hub);
    showView("hub");
  }

  function goBack() {
    if (navContext && navContext !== "home") renderGroup(navContext);
    else renderHub();
  }

  function openAction(actionId) {
    var found = findAction(actionId);
    if (!found || !found.action.implemented) return;
    var act = found.action;
    setPageHeader(act.title);
    setActiveNav(found.group.slug);
    var html = '<p><a href="#/" id="back-hub">Back</a></p>';
    html += '<form id="action-form">';
    html += "<fieldset>";
    html += "<legend>" + escapeHtml(act.title) + "</legend>";
    html += '<p class="text-muted">' + escapeHtml(act.description) + "</p>";
    html += '<div class="alert alert-danger hidden" id="action-error"></div>';
    html += '<input type="hidden" name="action_id" value="' + escapeHtml(act.id) + '" />';
    html += '<div class="form-group">';
    html += '<label class="control-label" for="deposition_ids">Deposition IDs</label>';
    html +=
      '<textarea id="deposition_ids" name="deposition_ids" class="form-control" required placeholder="D_1292156088"></textarea>';
    html += '<p class="help-block">One per line, or comma / space separated.</p>';
    html += "</div>";
    if (act.id === "run_or_restart_level2_module") {
      html += "<p><strong>Module</strong></p>";
      LEVEL2_MODULES.forEach(function (mod, idx) {
        html += '<div class="radio"><label><input type="radio" name="level2_module" value="' +
          mod.id +
          '" data-has-run-ui="' +
          (mod.has_run_ui ? "1" : "0") +
          '"' +
          (idx === 0 ? " checked" : "") +
          " /> " +
          escapeHtml(mod.label) +
          (mod.has_run_ui ? " <span class=\"text-muted\">(Run+UI available)</span>" : "") +
          "</label></div>";
      });
      html += "<p><strong>Action</strong></p>";
      html +=
        '<div class="radio"><label><input type="radio" name="level2_operation" value="run" checked /> Run</label></div>';
      html +=
        '<div class="radio" id="level2-op-run_ui"><label><input type="radio" name="level2_operation" value="run_ui" /> Run+UI</label></div>';
      html +=
        '<div class="radio"><label><input type="radio" name="level2_operation" value="restart" /> Restart</label></div>';
      html += '<p class="help-block hidden" id="level2-run-ui-hint">Run+UI is not available for this module.</p>';
    }
    if (act.id === "extend_hold_date") {
      html += "<p><strong>Extension</strong></p>";
      html += '<div class="radio"><label><input type="radio" name="hold_months" value="3" checked /> 3 months</label></div>';
      html += '<div class="radio"><label><input type="radio" name="hold_months" value="6" /> 6 months</label></div>';
      html +=
        '<div class="checkbox"><label><input type="checkbox" name="hold_notify" value="yes" /> Also send the hold-extension letter</label></div>';
    }
    if (act.id === "set_auth_validation_letter") {
      html +=
        '<div class="checkbox"><label><input type="checkbox" name="send_letter" value="yes" checked /> Send Validation Letter after AUTH</label></div>';
    }
    if (act.id === "send_template_message") {
      html += "<p><strong>Template</strong></p>";
      MESSAGE_TEMPLATES.forEach(function (tmpl, idx) {
        html +=
          '<div class="radio"><label><input type="radio" name="message_template_id" value="' +
          tmpl.id +
          '"' +
          (idx === 0 ? " checked" : "") +
          " /> " +
          escapeHtml(tmpl.label) +
          "</label></div>";
      });
    }
    if (act.id === "add_internal_note") {
      html += '<div class="form-group"><label class="control-label" for="note_subject">Subject</label>';
      html += '<input id="note_subject" name="note_subject" class="form-control" type="text" required /></div>';
      html += '<div class="form-group"><label class="control-label" for="note_body">Note</label>';
      html += '<textarea id="note_body" name="note_body" class="form-control" required></textarea></div>';
    }
    if (act.id === "set_internal_notes_flag") {
      html += "<p><strong>Notes flag</strong></p>";
      html +=
        '<div class="radio"><label><input type="radio" name="notes_flag" value="enable" checked /> Enable</label></div>';
      html += '<div class="radio"><label><input type="radio" name="notes_flag" value="disable" /> Disable</label></div>';
    }
    html += '<input class="btn btn-primary" type="submit" value="Start run" />';
    html += "</fieldset></form>";
    views.action.innerHTML = html;
    $("back-hub").addEventListener("click", function (ev) {
      ev.preventDefault();
      goBack();
    });
    var form = $("action-form");
    if (act.id === "run_or_restart_level2_module") {
      var runUi = form.querySelector('input[name="level2_operation"][value="run_ui"]');
      var hint = $("level2-run-ui-hint");
      function syncRunUi() {
        var mod = form.querySelector('input[name="level2_module"]:checked');
        var allowed = !!(mod && mod.getAttribute("data-has-run-ui") === "1");
        runUi.disabled = !allowed;
        hint.classList.toggle("hidden", allowed);
        if (!allowed && runUi.checked) {
          form.querySelector('input[name="level2_operation"][value="run"]').checked = true;
        }
      }
      form.querySelectorAll('input[name="level2_module"]').forEach(function (el) {
        el.addEventListener("change", syncRunUi);
      });
      syncRunUi();
    }
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var fields = {
        action_id: act.id,
        deposition_ids: $("deposition_ids").value
      };
      if (act.id === "run_or_restart_level2_module") {
        var mod = form.querySelector('input[name="level2_module"]:checked');
        var op = form.querySelector('input[name="level2_operation"]:checked');
        fields.level2_module = mod ? mod.value : "";
        fields.level2_operation = op ? op.value : "";
      }
      if (act.id === "extend_hold_date") {
        var months = form.querySelector('input[name="hold_months"]:checked');
        fields.hold_months = months ? months.value : "";
        fields.hold_notify = form.querySelector('input[name="hold_notify"]:checked') ? "yes" : "no";
      }
      if (act.id === "set_auth_validation_letter") {
        fields.send_letter = form.querySelector('input[name="send_letter"]:checked') ? "yes" : "no";
      }
      if (act.id === "send_template_message") {
        var tmpl = form.querySelector('input[name="message_template_id"]:checked');
        fields.message_template_id = tmpl ? tmpl.value : "";
      }
      if (act.id === "add_internal_note") {
        fields.note_subject = $("note_subject").value;
        fields.note_body = $("note_body").value;
      }
      if (act.id === "set_internal_notes_flag") {
        var flag = form.querySelector('input[name="notes_flag"]:checked');
        fields.notes_flag = flag ? flag.value : "";
      }
      var btn = form.querySelector('[type=submit]');
      btn.disabled = true;
      post("/console_start", fields)
        .then(renderJob)
        .catch(function (err) {
          showError($("action-error"), err.message);
          btn.disabled = false;
        });
    });
    showView("action");
  }

  function badge(status) {
    var cls = "label label-default";
    if (status === "ok") cls = "label label-success";
    else if (status === "failed") cls = "label label-danger";
    else if (status === "running") cls = "label label-warning";
    return '<span class="' + cls + '">' + escapeHtml(status || "waiting") + "</span>";
  }

  function renderJob(job) {
    var extra = job.extra || {};
    var rows = job.rows || [];
    setPageHeader(job.action_title || "Job status");
    var html = '<p><a href="#/" id="back-hub-job">Back</a></p>';
    html += "<fieldset><legend>Job status</legend>";
    html += "<p><strong>Action</strong> " + escapeHtml(job.action_title || "") + "</p>";
    html += "<p><strong>Status</strong> " + escapeHtml(job.status || "") + "</p>";
    html +=
      "<p><strong>Deposition IDs</strong> " +
      (job.deposition_ids || []).length +
      " total · <code>" +
      escapeHtml((job.deposition_ids || []).join(", ")) +
      "</code></p>";
    if (extra.level2_label) {
      html +=
        "<p><strong>Module</strong> " +
        escapeHtml(extra.level2_label) +
        " · " +
        escapeHtml(extra.level2_operation || "") +
        "</p>";
    }
    if (extra.message_template_label) {
      html += "<p><strong>Template</strong> " + escapeHtml(extra.message_template_label) + "</p>";
    }
    if (extra.hold_months) {
      html += "<p><strong>Hold</strong> +" + escapeHtml(String(extra.hold_months)) + " months";
      if (extra.hold_notify) html += " · notify";
      html += "</p>";
    }
    if (extra.send_letter_label) {
      html += "<p><strong>AUTH</strong> " + escapeHtml(extra.send_letter_label) + "</p>";
    }
    html +=
      "<p><strong>Run summary</strong> " +
      badge("ok") +
      " " +
      (job.ok || 0) +
      " " +
      badge("failed") +
      " " +
      (job.failed || 0) +
      " " +
      badge("waiting") +
      " " +
      (job.waiting || 0) +
      "</p>";
    if (job.error) html += '<div class="alert alert-danger">' + escapeHtml(job.error) + "</div>";
    html += "</fieldset>";
    html += "<h4>Per-deposition result</h4>";
    html +=
      '<table class="table table-bordered table-condensed table-striped"><thead><tr><th>Deposition ID</th><th>Result</th><th>Error</th></tr></thead><tbody>';
    rows.forEach(function (row) {
      html +=
        "<tr><td><code>" +
        escapeHtml(row.deposition_id) +
        "</code></td><td>" +
        badge(row.status) +
        "</td><td>" +
        escapeHtml(row.error || "") +
        "</td></tr>";
    });
    html += "</tbody></table>";
    html += "<h4>Log</h4><pre class=\"console-log\">" + escapeHtml((job.log || []).join("\n")) + "</pre>";
    views.job.innerHTML = html;
    $("back-hub-job").addEventListener("click", function (ev) {
      ev.preventDefault();
      goBack();
    });
    showView("job");
  }

  function goLogin(message) {
    clearSession();
    navContext = "home";
    renderHeader();
    showError($("login-error"), message || "");
    $("login-form").reset();
    showView("login");
    var userField = $("id_username");
    if (userField) userField.focus();
  }

  function goApp(data) {
    saveSession({
      sessionid: data.sessionid,
      annotator: data.annotator,
      first_name: data.first_name || "",
      last_name: data.last_name || ""
    });
    renderHeader();
    renderNav();
    renderHub();
  }

  $("top-menu-options").addEventListener("click", function (ev) {
    var link = ev.target.closest ? ev.target.closest("a[data-nav]") : null;
    if (!link) return;
    ev.preventDefault();
    var slug = link.getAttribute("data-nav");
    if (slug === "home") renderHub();
    else renderGroup(slug);
  });

  $("login-form").addEventListener("submit", function (ev) {
    ev.preventDefault();
    showError($("login-error"), "");
    session = null;
    post("/console_login", {
      username: $("id_username").value,
      password: $("id_psw").value
    })
      .then(goApp)
      .catch(function (err) {
        showError($("login-error"), err.message);
      });
  });

  $("logout-btn").addEventListener("click", function (ev) {
    ev.preventDefault();
    post("/console_logout", {}).finally(function () {
      goLogin();
    });
  });

  $("brand-link").addEventListener("click", function (ev) {
    ev.preventDefault();
    if (session) renderHub();
    else goLogin();
  });

  session = loadSession();
  if (session && session.sessionid) {
    post("/console_whoami", {})
      .then(function (data) {
        goApp(data);
      })
      .catch(function () {
        goLogin();
      });
  } else {
    goLogin();
  }
})();
