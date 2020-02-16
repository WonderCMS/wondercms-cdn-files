function fieldSave(id, newContent, dataTarget, dataMenu, dataVisibility, oldContent) {
    if (newContent !== oldContent) {
        $("#save").show(), $.post("", {
            fieldname: id,
            token: token,
            content: newContent,
            target: dataTarget,
            menu: dataMenu,
            visibility: dataVisibility
        }, function (a) {
        }).always(function () {
            window.location.reload();
        });
    } else {
        const target = $('#' + id);
        target.removeClass('editTextOpen');
        target.html(newContent);
    }
}

function editableTextArea(editableTarget, editable) {
    const data = (
        target = editableTarget,
            isEditable = editable,
            content = target.html(),
            oldContent = target.html(),
            title = target.attr("title") ? '"' + target.attr("title") + '" ' : '',
            targetId = target.attr('id'),
        "<textarea " + title + ' id="' + targetId + "_field\" onblur=\"" +
        "fieldSave(targetId,(this.value),target.data('target'),target.data('menu'),target.data('visibility'), oldContent);" +
        "\">" + content + "</textarea>"
    );

    editableTarget.html(data);
}

// Open direct tab in modal
$("#settingsModal").on("show.bs.modal", function (t) {
    var e = $(t.relatedTarget);
    $("a[href='" + e.data("target-tab") + "']").tab("show")
});

$(document).tabOverride(!0, "textarea");

$(document).ready(function () {
    // Loader
    $("body").on("click", "[data-loader-id]", function (t) {
        $("#" + $(t.target).data("loader-id")).show()
    });

    // Editable fields content save
    $("body").on("click", "div.editText:not(.editTextOpen)", function () {
        const target = $(this);
        target.addClass('editTextOpen');
        editableTextArea(target, target.hasClass("editable"));
        target.children(':first').focus();
        autosize($('textarea'));
    });

    // Menu item hidden or visible
    $("body").on("click", "i.menu-toggle", function () {
        var t = $(this), e = (setTimeout(function () {
            window.location.reload()
        }, 500), t.attr("data-menu"));
        t.hasClass("menu-item-hide") ? (t.removeClass("glyphicon-eye-open menu-item-hide").addClass("glyphicon-eye-close menu-item-show"), t.attr("title", "Hide page from menu").attr("data-visibility", "hide"), $.post("", {
            fieldname: "menuItems",
            token: token,
            content: " ",
            target: "menuItemVsbl",
            menu: e,
            visibility: "hide"
        }, function (t) {
        })) : t.hasClass("menu-item-show") && (t.removeClass("glyphicon-eye-close menu-item-show").addClass("glyphicon-eye-open menu-item-hide"), t.attr("title", "Show page in menu").attr("data-visibility", "show"), $.post("", {
            fieldname: "menuItems",
            token: token,
            content: " ",
            target: "menuItemVsbl",
            menu: e,
            visibility: "show"
        }, function (t) {
        }))
    });

    // Add new page
    $("body").on("click", ".menu-item-add", function () {
        var t = prompt("Enter page name");
        if (!t) return !1;
        t = t.replace(/[`~;:'",.<>\{\}\[\]\\\/]/gi, "").trim(), $.post("", {
            fieldname: "menuItems",
            token: token,
            content: t,
            target: "menuItem",
            menu: "none"
        }, function (t) {
        }).done(setTimeout(function () {
            window.location.reload()
        }, 500))
    });

    // Reorder menu item
    $("body").on("click", ".menu-item-up,.menu-item-down", function () {
        var t = $(this), e = t.hasClass("menu-item-up") ? "-1" : "1", n = t.attr("data-menu");
        $.post("", {fieldname: "menuItems", token: token, content: e, target: "menuItemOrder", menu: n}, function (t) {
        }).done(function () {
            $("#menuSettings").parent().load("index.php #menuSettings")
        })
    })
});
