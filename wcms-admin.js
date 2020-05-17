class wcmsAdmin {
    constructor() {
        const self = this;

        // Modals
        const openModalButton = document.querySelectorAll('[data-toggle="wcms-modal"]');
        const closeModalButton = document.querySelectorAll('[data-dismiss="wcms-modal"]');
        const modals = document.getElementsByClassName('wcms-modal');

        openModalButton.forEach((element) => {
            element.addEventListener('click', function () {
                wcmsAdminActions.toggleModal(this, true);
            })
        });

        document.addEventListener('click', function(e) {
            if([...modals].includes(e.target) || [...closeModalButton].includes(e.target)) {
                wcmsAdminActions.toggleModal(this, false);
            }
        });

        // Tabs
        const navTabs = document.querySelectorAll('ul.nav-tabs > li > a');
        navTabs.forEach((element) => {
            element.addEventListener('click', function (e) {
                e.preventDefault();
                wcmsAdminActions.openTabAction(this);
            })
        });

        // Loader
        const loaderLinks = document.querySelectorAll('[data-loader-id]');
        loaderLinks.forEach((link) => {
            link.addEventListener('click', function (event) {
                wcmsAdminActions.showLoader(true, this.dataset.loaderId);
            })
        });

        // Editable fields content save
        const editableText = document.querySelectorAll('div.editText:not(.editTextOpen)');
        editableText.forEach((editableElement) => {
            editableElement.addEventListener('click', self.constructEditableFieldsAction);
        });

        // Menu item hidden or visible
        const menuToggling = document.querySelectorAll('i.menu-toggle');
        menuToggling.forEach((menuToggle) => {
            menuToggle.addEventListener('click', self.hideOrShowMenuItemsAction)
        });

        // Add new page
        document.getElementById('menuItemAdd').addEventListener('click', wcmsAdminActions.createNewPage);

        // Reorder menu item
        const menuSortTriggers = document.querySelectorAll('.menu-item-up, .menu-item-down');
        menuSortTriggers.forEach((sortTrigger) => {
            sortTrigger.addEventListener('click', self.reorderMenuItemsAction)
        });

        // Change default page
        document.getElementById('changeDefaultPage').addEventListener('change', wcmsAdminActions.changeDefaultPage);
    }

    /**
     * Method for creating textarea instead of selected editable fields
     */
    constructEditableFieldsAction() {
        const target = this;
        if (target.classList.contains('editTextOpen')) {
            return;
        }

        target.classList.add('editTextOpen');
        wcmsAdminActions.editableTextArea(target);
        target.firstChild.focus();

        const textarea = target.getElementsByTagName('textarea');
        autosize(textarea);
        tabOverride.set(textarea);
    }

    /**
     * Method for reordering the items from menu
     */
    reorderMenuItemsAction() {
        const target = this;
        const position = target.classList.contains('menu-item-up') ? '-1' : '1';

        wcmsAdminActions.sendPostRequest('menuItems', position, 'menuItemOrder', target.dataset.menu);
    }

    /**
     * Method for hiding or showing the items from menu
     */
    hideOrShowMenuItemsAction() {
        const target = this;
        let visibility = null;

        if (target.classList.contains('menu-item-hide')) {
            target.classList.remove('eyeShowIcon', 'menu-item-hide');
            target.classList.add('eyeHideIcon', 'menu-item-show');
            target.setAttribute('title', 'Hide page from menu');
            visibility = 'hide';
        } else if (target.classList.contains('menu-item-show')) {
            target.classList.add('eyeShowIcon', 'menu-item-hide');
            target.classList.remove('eyeHideIcon', 'menu-item-show');
            target.setAttribute('title', 'Show page in menu');
            visibility = 'show';
        } else {
            return;
        }

        target.setAttribute('data-visibility', visibility);
        wcmsAdminActions.sendPostRequest('menuItems', ' ', 'menuItemVsbl', target.dataset.menu, visibility);
    }
}

/**
 * Wcms action method
 */
const wcmsAdminActions = {
    /**
     * Method to open tab content
     */
    openTabAction(target) {
        const tabsNavContainer = target.closest('.nav-tabs');
        const tabContentId = target.getAttribute('href').replace('#', '');
        const tabContent = document.getElementById(tabContentId);
        const tabsContentContainer = tabContent.closest('.tab-content');

        tabsNavContainer.querySelector('.active').classList.remove('active');
        tabsContentContainer.querySelector('.active').classList.remove('active');
        tabContent.classList.add('active');
        target.classList.add('active');
    },

    /**
     * Toggle modal based on clicked element
     * @param target
     * @param show
     */
    toggleModal(target, show) {
        if (show) {
            const modalId = target.getAttribute('href').replace('#', '');
            document.body.classList.add('modal-open');
            document.getElementById(modalId).style.display = 'block';

            const targetTab = target.dataset.targetTab;
            if (targetTab) {
                const navTab = document.querySelector('ul.nav-tabs > li > a[href="' + targetTab + '"]');
                if (navTab) {
                    wcmsAdminActions.openTabAction(navTab);
                }
            }
            return;
        }

        document.body.classList.remove('modal-open');
        if (target.dataset && target.dataset.dismiss) {
            target.closest('.wcms-modal').style.display = 'none';
            return;
        }

        // close all modals
        [].forEach.call(document.getElementsByClassName('wcms-modal'), function(el) {
            el.style.display = 'none';
        });
    },

    /**
     * Method for creating new page
     *
     * @returns {boolean}
     */
    createNewPage: () => {
        let newPageName = prompt('Enter page name');
        if (!newPageName) {
            return false;
        }

        newPageName = newPageName.replace(/[`~;:'",.<>\{\}\[\]\\\/]/gi, '').trim();
        wcmsAdminActions.sendPostRequest('menuItems', newPageName, 'menuItem', 'none', 'hide');
    },

    /**
     * Method for changing default page
     *
     * @returns {boolean}
     */
    changeDefaultPage: () => {
        wcmsAdminActions.sendPostRequest('defaultPage', this.value, 'config');
    },

    /**
     * Ajax saving method
     */
    contentSave: (id, newContent, dataTarget, dataMenu, dataVisibility, oldContent) => {
        if (newContent !== oldContent) {
            wcmsAdminActions.sendPostRequest(id, newContent, dataTarget, dataMenu, dataVisibility);
            return;
        }

        const target = document.getElementById(id);
        target.classList.remove('editTextOpen');
        target.innerHTML = newContent;
    },

    /**
     * Post data to API and reload
     *
     * @param fieldname
     * @param content
     * @param target
     * @param menu
     * @param visibility
     */
    sendPostRequest: (fieldname, content, target, menu, visibility = null) => {
        wcmsAdminActions.showLoader(true);

        const dataRaw = {
            fieldname: fieldname,
            token: token,
            content: encodeURIComponent(content),
            target: target,
            menu: menu,
            visibility: visibility
        };
        const data = Object.keys(dataRaw).map(function (key, index) {
            return [key, dataRaw[key]].join('=');
        }).join('&');

        // Send request
        const request = new XMLHttpRequest();
        request.onreadystatechange = function () {
            setTimeout(() => window.location.reload(), 50);
        }
        request.open('POST', '', false);
        request.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded; charset=UTF-8');
        request.send(data);
    },

    /**
     * Show saving loader
     * @param show
     * @param loaderId
     */
    showLoader: (show, loaderId = 'save') => {
        const loader = document.getElementById(loaderId);
        loader.style.display = show ? 'block' : 'none';
    },

    /**
     * Create editable field after clicking on div
     * @param editableTarget
     */
    editableTextArea: (editableTarget) => {
        const target = editableTarget;
        const content = target.innerHTML;
        const targetId = target.getAttribute('id');

        const newElement = document.createElement('textarea');
        newElement.onblur = function () {
            wcmsAdminActions.contentSave(
                targetId,
                this.value,
                target.dataset.target,
                target.dataset.menu,
                target.dataset.visibility,
                content
            );
        }
        newElement.setAttribute('id', targetId + '_field');
        newElement.innerHTML = content;

        editableTarget.innerHTML = '';
        editableTarget.appendChild(newElement);
    }
}

document.addEventListener("DOMContentLoaded", function () {
    new wcmsAdmin();
});