function nl2br(a) {
    return (a + "").replace(/([^>\r\n]?)(\r\n|\n\r|\r|\n)/g, "$1<br>$2");
}

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
        const textarea = target.children('textarea').first();
        const content = textarea.val();
        target.html( content );
    }
}

function editableTextArea(editableTarget, editable) {
    const data = (
        target = editableTarget,
            isEditable = editable,
            content = isEditable ? target.html().replace(/<br>/gi, "\n") : target.html(),
            oldContent = target.html(),
            title = target.attr("title") ? '"' + target.attr("title") + '" ' : '',
            targetId = target.attr('id'),
        "<textarea " + title + ' id="' + targetId + "_field\" onblur=\"" +
        "fieldSave(targetId,(isEditable ? this.value : nl2br(this.value)),target.data('target'),target.data('menu'),target.data('visibility'), oldContent);" +
        "\">" + content + "</textarea>"
    );

    editableTarget.html(data);
}

$(document).tabOverride(!0, "textarea");
$(document).ready(function () {
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
        var a = $(this), c = (setTimeout(function () {
            window.location.reload()
        }, 500), a.attr("data-menu"));
        a.hasClass("menu-item-hide") ? (a.removeClass("glyphicon-eye-open menu-item-hide").addClass("glyphicon-eye-close menu-item-show"), a.attr("title", "Hide page from menu").attr("data-visibility", "hide"), $.post("", {
            fieldname: "menuItems",
            token: token,
            content: " ",
            target: "menuItemVsbl",
            menu: c,
            visibility: "hide"
        }, function (a) {
        })) : a.hasClass("menu-item-show") && (a.removeClass("glyphicon-eye-close menu-item-show").addClass("glyphicon-eye-open menu-item-hide"), a.attr("title", "Show page in menu").attr("data-visibility", "show"), $.post("", {
            fieldname: "menuItems",
            token: token,
            content: " ",
            target: "menuItemVsbl",
            menu: c,
            visibility: "show"
        }, function (a) {
        }))
    });

    // Add new page
    $("body").on("click", ".menu-item-add", function () {
        var newPage = prompt("Enter page name");
        if (!newPage) return !1;
        newPage = newPage.replace(/[`~;:'",.<>\{\}\[\]\\\/]/gi, "").trim(), $.post("", {
            fieldname: "menuItems",
            token: token,
            content: newPage,
            target: "menuItem",
            menu: "none"
        }, function (a) {
        }).done(setTimeout(function () {
            window.location.reload()
        }, 500))
    });

    // Reorder menu item
    $("body").on("click", ".menu-item-up,.menu-item-down", function () {
        var a = $(this), b = a.hasClass("menu-item-up") ? "-1" : "1", c = a.attr("data-menu");
        $.post("", {fieldname: "menuItems", token: token, content: b, target: "menuItemOrder", menu: c}, function (a) {
        }).done(function () {
            $("#menuSettings").parent().load("index.php #menuSettings")
        })
    })
});
