/* exported panelsContSelector updateThePanelsElements loadTAGradingSettingData deleteAttachment uploadAttachment
   collapseFile imageRotateIcons newEditPeerComponentsForm clearPeerMarks changeCurrentPeer getNonAnonPath findOpenTestcases
   hideIfEmpty autoResizeComment updateValue validateInput openAll exchangeTwoPanels changePanelsLayout gotoMainPage
   hidePanelPositionSelect */

/* global settingsData loadAllInlineImages generateCodeMirrorBlocks getGradeableId buildCourseUrl csrfToken getAnonId
   Twig loadPDFToolbar captureTabInModal registerKeyHandler onToggleEditMode registerKeyHandler scrollToComponent
   toggleComponent getPrevComponentId toggleCommonMark CUSTOM_MARK_ID getMarkIdFromOrder NO_COMPONENT_ID getFirstOpenComponentId
   getComponentIdByOrder closeComponent scrollToOverallComment getNextComponentId togglePanelSelectorModal
   initializeResizablePanels initializeResizablePanels closeAllComponents component_id:writable isSilentEditModeEnabled
   loadTAGradingSettingData */

// Used to reset users cookies
const cookie_version = 1;

// Width of mobile and Tablet screens width
const MOBILE_WIDTH = 540;

// tracks if the current display screen is mobile
let isMobileView = false;

// Panel elements info to be used for layout designs
let panelElements = [
    { str: 'autograding_results', icon: '.grading_toolbar .fa-list' },
    { str: 'grading_rubric', icon: '.grading_toolbar .fa-edit' },
    { str: 'submission_browser', icon: 'grading_toolbar .fa-folder-open.icon-header' },
    { str: 'solution_ta_notes', icon: 'grading_toolbar .fa-check.icon-header' },
    { str: 'student_info', icon: '.grading_toolbar .fa-user' },
    { str: 'peer_info', icon: '.grading_toolbar .fa-users' },
    { str: 'discussion_browser', icon: '.grading_toolbar .fa-comment-alt' },
    { str: 'grade_inquiry_info', icon: '.grading_toolbar .grade_inquiry_icon' },
    { str: 'notebook-view', icon: '.grading_toolbar .fas fa-book-open' },
];

// Tracks the layout of TA grading page
const taLayoutDet = {
    numOfPanelsEnabled: 1,
    isFullScreenMode: false,
    isFullLeftColumnMode: false,
    currentOpenPanel: panelElements[0].str,
    currentTwoPanels: {
        leftTop: null,
        leftBottom: null,
        rightTop: null,
        rightBottom: null,
    },
    currentActivePanels: {
        leftTop: false,
        leftBottom: false,
        rightTop: false,
        rightBottom: false,
    },
    dividedColName: 'LEFT',
    leftPanelWidth: '50%',
    bottomPanelHeight: '50%',
    bottomFourPanelRightHeight: '50%',
};

const settingsCallbacks = {
    'general-setting-arrow-function': changeStudentArrowTooltips,
    'general-setting-navigate-assigned-students-only': function (value) {
        // eslint-disable-next-line eqeqeq
        if (value == 'true') {
            Cookies.set('view', 'assigned', { path: '/' });
        }
        else {
            Cookies.set('view', 'all', { path: '/' });
        }
    },
};

// Grading Panel header width
let maxHeaderWidth = 0;
// Navigation Toolbar Panel header width
let maxNavbarWidth = 0;

// Various Ta-grading page selector for DOM manipulation
let panelsContSelector = '.two-panel-cont';
const leftSelector = '.two-panel-item.two-panel-left';
const verticalDragBarSelector = '.two-panel-drag-bar';
const leftHorizDragBarSelector = '.panel-item-section-drag-bar.panel-item-left-drag';
const rightHorizDragBarSelector = '.panel-item-section-drag-bar.panel-item-right-drag';
const panelsBucket = {
    leftTopSelector: '.two-panel-item.two-panel-left .left-top',
    leftBottomSelector: '.two-panel-item.two-panel-left .left-bottom',
    rightTopSelector: '.two-panel-item.two-panel-right .right-top',
    rightBottomSelector: '.two-panel-item.two-panel-right .right-bottom',
};

// Only keep those panels which are available
function updateThePanelsElements(panelsAvailabilityObj) {
    // Attach the isAvailable to the panel elements to manage them
    panelElements = panelElements.filter((panel) => {
        return !!panelsAvailabilityObj[panel.str];
    });
}

$(() => {
    Object.assign(taLayoutDet, getSavedTaLayoutDetails());
    // Check initially if its the mobile screen view or not
    isMobileView = window.innerWidth <= MOBILE_WIDTH;
    initializeTaLayout();

    window.addEventListener('resize', () => {
        const wasMobileView = isMobileView;
        isMobileView = window.innerWidth <= MOBILE_WIDTH;
        // if the width is switched between smaller and bigger screens, re-initialize the layout
        if (wasMobileView !== isMobileView) {
            initializeTaLayout();
        }
    });

    loadTAGradingSettingData();

    for (let i = 0; i < settingsData.length; i++) {
        for (let x = 0; x < settingsData[i].values.length; x++) {
            const storageCode = settingsData[i].values[x].storageCode;
            const item = localStorage.getItem(storageCode);
            if (item && Object.prototype.hasOwnProperty.call(settingsCallbacks, storageCode)) {
                settingsCallbacks[storageCode](item);
            }
        }
    }

    $('#settings-popup').on('change', '.ta-grading-setting-option', function () {
        const storageCode = $(this).attr('data-storage-code');
        if (storageCode) {
            localStorage.setItem(storageCode, this.value);
            if (settingsCallbacks && Object.prototype.hasOwnProperty.call(settingsCallbacks, storageCode)) {
                settingsCallbacks[storageCode](this.value);
                if (this.value !== 'active-inquiry') {
                    // if user change setting to non-grade inquiry option, change the inquiry_status to off and set inquiry_status to off in grading index page
                    Cookies.set('inquiry_status', 'off');
                }
                else {
                    Cookies.set('inquiry_status', 'on');
                }
            }
        }
    });

    // Progress bar value
    const value = $('.progressbar').val() ? $('.progressbar').val() : 0;
    $('.progress-value').html(`<b>${value}%</b>`);

    // Grading panel toggle buttons
    $('.grade-panel button').click(function () {
        const btnCont = $(this).parent();
        const panelSpanId = btnCont.attr('id');

        if (!panelSpanId) {
            return;
        }

        const panelId = panelSpanId.split(/(_|-)btn/)[0];
        const selectEle = $(`select#${panelId}_select`);

        // Hide all select dropdown except the current one
        $('select.panel-position-cont').not(selectEle).hide();

        const isPanelOpen = $(`#${panelId}`).is(':visible');
        // If panel is not in-view and two/three-panel-mode is enabled show the drop-down to select position,
        // otherwise just toggle it
        if (isPanelOpen || +taLayoutDet.numOfPanelsEnabled === 1) {
            setPanelsVisibilities(panelId);
        }
        else {
            // removing previously selected option
            selectEle.val(0);
            selectEle.is(':visible') ? selectEle.hide() : selectEle.show();
        }
    });

    // panel position selector change event
    $('.grade-panel .panel-position-cont').change(function () {
        const panelSpanId = $(this).parent().attr('id');
        const position = $(this).val();
        if (panelSpanId) {
            const panelId = panelSpanId.split(/(_|-)btn/)[0];
            setPanelsVisibilities(panelId, null, position);
            $(`select#${panelId}_select`).hide();
            checkNotebookScroll();
        }
    });

    // eslint-disable-next-line eqeqeq
    if (localStorage.getItem('notebook-setting-file-submission-expand') == 'true') {
        const notebookPanel = $('#notebook-view');
        if (notebookPanel.length !== 0) {
            const notebookItems = notebookPanel.find('.openAllFilesubmissions');
            for (let i = 0; i < notebookItems.length; i++) {
                notebookItems[i].onclick();
            }
        }
    }

    // Remove the select options which are open
    function hidePanelPositionSelect() {
        $('select.panel-position-cont').hide();
        document.removeEventListener('click', hidePanelPositionSelect);
    }
    // Check for the panels status initially
    adjustGradingPanelHeader();
    const resizeObserver = new ResizeObserver(() => {
        adjustGradingPanelHeader();
    });
    // calling it for the first time i.e initializing
    adjustGradingPanelHeader();
    resizeObserver.observe(document.getElementById('grading-panel-header'));

    notebookScrollLoad();
    checkNotebookScroll();
});

function changeStudentArrowTooltips(data) {
    const inquiry_status = Cookies.get('inquiry_status');
    if (inquiry_status === 'on') {
        data = 'active-inquiry';
    }
    else {
        // if inquiry_status is off, and data equals active inquiry means the user set setting to active-inquiry manually
        // and need to set back to default since user also manually changed inquiry_status to off.
        if (data === 'active-inquiry') {
            data = 'default';
        }
    }
    let component_id = NO_COMPONENT_ID;
    switch (data) {
        case 'ungraded':
            component_id = getFirstOpenComponentId(false);
            if (component_id === NO_COMPONENT_ID) {
                $('#prev-student-navlink').find('i').first().attr('title', 'Previous ungraded student');
                $('#next-student-navlink').find('i').first().attr('title', 'Next ungraded student');
            }
            else {
                $('#prev-student-navlink').find('i').first().attr('title', `Previous ungraded student (${$(`#component-${component_id}`).find('.component-title').text().trim()})`);
                $('#next-student-navlink').find('i').first().attr('title', `Next ungraded student (${$(`#component-${component_id}`).find('.component-title').text().trim()})`);
            }
            break;
        case 'itempool':
            component_id = getFirstOpenComponentId(true);
            if (component_id === NO_COMPONENT_ID) {
                $('#prev-student-navlink').find('i').first().attr('title', 'Previous student');
                $('#next-student-navlink').find('i').first().attr('title', 'Next student');
            }
            else {
                $('#prev-student-navlink').find('i').first().attr('title', `Previous student (item ${$(`#component-${component_id}`).attr('data-itempool_id')}; ${$(`#component-${component_id}`).find('.component-title').text().trim()})`);
                $('#next-student-navlink').find('i').first().attr('title', `Next student (item ${$(`#component-${component_id}`).attr('data-itempool_id')}; ${$(`#component-${component_id}`).find('.component-title').text().trim()})`);
            }
            break;
        case 'ungraded-itempool':
            component_id = getFirstOpenComponentId(true);
            if (component_id === NO_COMPONENT_ID) {
                component_id = getFirstOpenComponentId();
                if (component_id === NO_COMPONENT_ID) {
                    $('#prev-student-navlink').find('i').first().attr('title', 'Previous ungraded student');
                    $('#next-student-navlink').find('i').first().attr('title', 'Next ungraded student');
                }
                else {
                    $('#prev-student-navlink').find('i').first().attr('title', `Previous ungraded student (${$(`#component-${component_id}`).find('.component-title').text().trim()})`);
                    $('#next-student-navlink').find('i').first().attr('title', `Next ungraded student (${$(`#component-${component_id}`).find('.component-title').text().trim()})`);
                }
            }
            else {
                $('#prev-student-navlink').find('i').first().attr('title', `Previous ungraded student (item ${$(`#component-${component_id}`).attr('data-itempool_id')}; ${$(`#component-${component_id}`).find('.component-title').text().trim()})`);
                $('#next-student-navlink').find('i').first().attr('title', `Next ungraded student (item ${$(`#component-${component_id}`).attr('data-itempool_id')}; ${$(`#component-${component_id}`).find('.component-title').text().trim()})`);
            }
            break;
        case 'inquiry':
            component_id = getFirstOpenComponentId();
            if (component_id === NO_COMPONENT_ID) {
                $('#prev-student-navlink').find('i').first().attr('title', 'Previous student with inquiry');
                $('#next-student-navlink').find('i').first().attr('title', 'Next student with inquiry');
            }
            else {
                $('#prev-student-navlink').find('i').first().attr('title', `Previous student with inquiry (${$(`#component-${component_id}`).find('.component-title').text().trim()})`);
                $('#next-student-navlink').find('i').first().attr('title', `Next student with inquiry (${$(`#component-${component_id}`).find('.component-title').text().trim()})`);
            }
            break;
        case 'active-inquiry':
            component_id = getFirstOpenComponentId();
            if (component_id === NO_COMPONENT_ID) {
                $('#prev-student-navlink').find('i').first().attr('title', 'Previous student with active inquiry');
                $('#next-student-navlink').find('i').first().attr('title', 'Next student with active inquiry');
            }
            else {
                $('#prev-student-navlink').find('i').first().attr('title', `Previous student with active inquiry (${$(`#component-${component_id}`).find('.component-title').text().trim()})`);
                $('#next-student-navlink').find('i').first().attr('title', `Next student with active inquiry (${$(`#component-${component_id}`).find('.component-title').text().trim()})`);
            }
            break;
        default:
            $('#prev-student-navlink').find('i').first().attr('title', 'Previous student');
            $('#next-student-navlink').find('i').first().attr('title', 'Next student');
            break;
    }
}

const orig_toggleComponent = window.toggleComponent;
window.toggleComponent = function (component_id, saveChanges) {
    const ret = orig_toggleComponent(component_id, saveChanges);
    return ret.then(() => {
        changeStudentArrowTooltips(localStorage.getItem('general-setting-arrow-function') || 'default');
    });
};

function checkNotebookScroll() {
    if (taLayoutDet.currentTwoPanels.leftTop === 'notebook-view'
        || taLayoutDet.currentTwoPanels.leftBottom === 'notebook-view'
        || taLayoutDet.currentTwoPanels.rightTop === 'notebook-view'
        || taLayoutDet.currentTwoPanels.rightBottom === 'notebook-view'
        || taLayoutDet.currentOpenPanel === 'notebook-view'
    ) {
        $('#notebook-view').scroll(delayedNotebookSave());
    }
    else {
        $('#notebook-view').off('scroll');
        localStorage.removeItem('ta-grading-notebook-view-scroll-id');
        localStorage.removeItem('ta-grading-notebook-view-scroll-item');
    }
}

function delayedNotebookSave() {
    let timer;
    return function () {
        timer && clearTimeout(timer);
        timer = setTimeout(notebookScrollSave, 250);
    };
}

function notebookScrollLoad() {
    const notebookView = $('#notebook-view');
    if (notebookView !== 0 && notebookView.is(':visible')) {
        let elementID = localStorage.getItem('ta-grading-notebook-view-scroll-id');
        let element = null;
        if (elementID === null) {
            elementID = localStorage.getItem('ta-grading-notebook-view-scroll-item');
            if (elementID !== null) {
                element = $(`[data-item-ref=${elementID}]`);
            }
        }
        else {
            element = $(`[data-non-item-ref=${elementID}]`);
        }
        if (element !== null) {
            if (element.length !== 0) {
                notebookView.scrollTop(element.offset().top - notebookView.offset().top + notebookView.scrollTop());
            }
            else {
                localStorage.removeItem('ta-grading-notebook-view-scroll-id');
                localStorage.removeItem('ta-grading-notebook-view-scroll-item');
            }
        }
    }
}

function notebookScrollSave() {
    const notebookView = $('#notebook-view');
    if (notebookView.length !== 0 && notebookView.is(':visible')) {
        const notebookTop = $('#notebook-view').offset().top;
        let element = $('#content_0');
        if (notebookView.scrollTop() + notebookView.innerHeight() + 1 > notebookView[0].scrollHeight) {
            element = $('[id^=content_]').last();
        }
        else {
            while (element.length !== 0) {
                if (element.offset().top > notebookTop) {
                    break;
                }
                element = element.next();
            }
        }

        if (element.length !== 0) {
            if (element.attr('data-item-ref') === undefined) {
                localStorage.setItem('ta-grading-notebook-view-scroll-id', element.attr('data-non-item-ref'));
                localStorage.removeItem('ta-grading-notebook-view-scroll-item');
            }
            else {
                localStorage.setItem('ta-grading-notebook-view-scroll-item', element.attr('data-item-ref'));
                localStorage.removeItem('ta-grading-notebook-view-scroll-id');
            }
        }
    }
}

// returns taLayoutDet object from LS, and if its not present returns empty object
function getSavedTaLayoutDetails() {
    const savedData = localStorage.getItem('taLayoutDetails');
    return savedData ? JSON.parse(savedData) : {};
}

function saveTaLayoutDetails() {
    localStorage.setItem('taLayoutDetails', JSON.stringify(taLayoutDet));
}

function saveResizedColsDimensions(updateValue, isHorizontalResize) {
    if (isHorizontalResize) {
        taLayoutDet.bottomPanelHeight = updateValue;
    }
    else {
        taLayoutDet.leftPanelWidth = updateValue;
    }
    saveTaLayoutDetails();
}

function saveRightResizedColsDimensions(updateValue, isHorizontalResize) {
    if (isHorizontalResize) {
        taLayoutDet.bottomFourPanelRightHeight = updateValue;
    }
    else {
        taLayoutDet.leftPanelWidth = updateValue;
    }
    saveTaLayoutDetails();
}

function initializeHorizontalTwoPanelDrag() {
    if (taLayoutDet.dividedColName === 'RIGHT') {
        initializeResizablePanels(panelsBucket.rightBottomSelector, rightHorizDragBarSelector, true, saveResizedColsDimensions);
    }
    if (taLayoutDet.dividedColName === 'LEFT') {
        if (taLayoutDet.numOfPanelsEnabled === 4) {
            initializeResizablePanels(panelsBucket.rightBottomSelector, rightHorizDragBarSelector, true, saveRightResizedColsDimensions);
        }
        initializeResizablePanels(panelsBucket.leftBottomSelector, leftHorizDragBarSelector, true, saveResizedColsDimensions);
    }
}

function initializeTaLayout() {
    if (isMobileView) {
        resetSinglePanelLayout();
    }
    else if (taLayoutDet.numOfPanelsEnabled) {
        togglePanelLayoutModes(true);
        if (taLayoutDet.isFullLeftColumnMode) {
            toggleFullLeftColumnMode(true);
        }
        // initialize the layout\
        initializeResizablePanels(leftSelector, verticalDragBarSelector, false, saveResizedColsDimensions);
        initializeHorizontalTwoPanelDrag();
    }
    else {
        setPanelsVisibilities(taLayoutDet.currentOpenPanel);
    }
    if (taLayoutDet.isFullScreenMode) {
        toggleFullScreenMode();
    }
    updateLayoutDimensions();
    updatePanelOptions();
    readCookies();
}

function updateLayoutDimensions() {
    // updates width of left columns (normal + full-left-col) with the last saved layout width
    $('.two-panel-item.two-panel-left').css({
        width: taLayoutDet.leftPanelWidth ? taLayoutDet.leftPanelWidth : '50%',
    });
    // updates width of left columns (normal + full-left-col) with the last saved layout width
    const bottomRow = taLayoutDet.dividedColName === 'RIGHT' ? $('.panel-item-section.right-bottom') : $('.panel-item-section.left-bottom');
    bottomRow.css({
        height: taLayoutDet.bottomPanelHeight ? taLayoutDet.bottomPanelHeight : '50%',
    });

    if (taLayoutDet.numOfPanelsEnabled === 4) {
        $('.panel-item-section.right-bottom').css({
            height: taLayoutDet.bottomFourPanelRightHeight ? taLayoutDet.bottomFourPanelRightHeight : '50%',
        });
    }
}

function updatePanelOptions() {
    if (taLayoutDet.numOfPanelsEnabled === 1) {
        return;
    }
    $('.grade-panel .panel-position-cont').attr('size', taLayoutDet.numOfPanelsEnabled);
    const panelOptions = $('.grade-panel .panel-position-cont option');
    panelOptions.each((idx) => {
        if (panelOptions[idx].value === 'leftTop') {
            if (taLayoutDet.numOfPanelsEnabled === 2 || (taLayoutDet.numOfPanelsEnabled === 3 && taLayoutDet.dividedColName === 'RIGHT')) {
                panelOptions[idx].text = 'Open as left panel';
            }
            else {
                panelOptions[idx].text = 'Open as top left panel';
            }
        }
        else if (panelOptions[idx].value === 'leftBottom') {
            if (taLayoutDet.numOfPanelsEnabled === 2 || (taLayoutDet.numOfPanelsEnabled === 3 && taLayoutDet.dividedColName === 'RIGHT')) {
                panelOptions[idx].classList.add('hide');
            }
            else {
                panelOptions[idx].classList.remove('hide');
            }
        }
        else if (panelOptions[idx].value === 'rightTop') {
            if (taLayoutDet.numOfPanelsEnabled === 2 || (taLayoutDet.numOfPanelsEnabled === 3 && taLayoutDet.dividedColName !== 'RIGHT')) {
                panelOptions[idx].text = 'Open as right panel';
            }
            else {
                panelOptions[idx].text = 'Open as top right panel';
            }
        }
        else if (panelOptions[idx].value === 'rightBottom') {
            if (taLayoutDet.numOfPanelsEnabled === 2 || (taLayoutDet.numOfPanelsEnabled === 3 && taLayoutDet.dividedColName !== 'RIGHT')) {
                panelOptions[idx].classList.add('hide');
            }
            else {
                panelOptions[idx].classList.remove('hide');
            }
        }
    });
}

/*
  Adjust buttons inside Grading panel header and shows only icons on smaller screens
 */
function adjustGradingPanelHeader() {
    const header = $('#grading-panel-header');
    const headerBox = $('.panel-header-box');
    const navBar = $('#bar_wrapper');
    const navBarBox = $('.navigation-box');

    if (maxHeaderWidth < headerBox.width()) {
        maxHeaderWidth = headerBox.width();
    }
    if (maxHeaderWidth > header.width()) {
        headerBox.addClass('smaller-header');
    }
    else {
        headerBox.removeClass('smaller-header');
    }
    // changes for the navigation toolbar buttons
    if (maxNavbarWidth < $('.grading_toolbar').width()) {
        maxNavbarWidth = $('.grading_toolbar').width();
    }
    if (maxNavbarWidth > navBar.width()) {
        navBarBox.addClass('smaller-navbar');
    }
    else {
        navBarBox.removeClass('smaller-navbar');
    }
    // On mobile display screen hide the two-panel-mode
    if (isMobileView) {
        // hide the buttons
        navBarBox.addClass('mobile-view');
    }
    else {
        navBarBox.removeClass('mobile-view');
    }

    // From the complete content remove the height occupied by other elements
    let height = 0;
    $('.panels-container').first().siblings().each(function () {
        if ($(this).css('display') !== 'none') {
            height += $(this).outerHeight(true);
        }
    });

    document.querySelector('.panels-container').style.height = `calc(100% - ${height}px)`;
}

function onAjaxInit() { }

function readCookies() {
    const silent_edit_enabled = Cookies.get('silent_edit_enabled') || '';

    const autoscroll = Cookies.get('autoscroll') || '';
    const opened_mark = Cookies.get('opened_mark') || '';
    const scroll_pixel = Cookies.get('scroll_pixel') || '';

    const testcases = Cookies.get('testcases') || '';

    const files = Cookies.get('files') || '';

    $('#silent-edit-id').prop('checked', silent_edit_enabled);
    // eslint-disable-next-line no-func-assign
    onAjaxInit = function () {
        $(`#title-${opened_mark}`).click();
        if (scroll_pixel > 0) {
            document.getElementById('grading_rubric').scrollTop = scroll_pixel;
        }
    };

    if (autoscroll === 'on') {
        $('#autoscroll_id')[0].checked = true;
        const files_array = JSON.parse(files);
        files_array.forEach((element) => {
            const file_path = element.split('#$SPLIT#$');
            let current = $('#file-container');
            for (let x = 0; x < file_path.length; x++) {
                current.children().each(function () {
                    if (x === file_path.length - 1) {
                        $(this).children('div[id^=file_viewer_]').each(function () {
                            // eslint-disable-next-line eqeqeq
                            if ($(this)[0].dataset.file_name == file_path[x] && !$($(this)[0]).hasClass('open')) {
                                openFrame($(this)[0].dataset.file_name, $(this)[0].dataset.file_url, $(this).attr('id').split('_')[2]);
                            }
                        });
                        $(this).children('div[id^=div_viewer_]').each(function () {
                            // eslint-disable-next-line eqeqeq
                            if ($(this)[0].dataset.file_name == file_path[x] && !$($(this)[0]).hasClass('open')) {
                                openDiv($(this).attr('id').split('_')[2]);
                            }
                        });
                    }
                    else {
                        $(this).children('div[id^=div_viewer_]').each(function () {
                            // eslint-disable-next-line eqeqeq
                            if ($(this)[0].dataset.file_name == file_path[x]) {
                                current = $(this);
                                return false;
                            }
                        });
                    }
                });
            }
        });
    }
    for (let x = 0; x < testcases.length; x++) {
        if (testcases[x] !== '[' && testcases[x] !== ']') {
            openAutoGrading(testcases[x]);
        }
    }
}

function updateCookies() {
    Cookies.set('silent_edit_enabled', isSilentEditModeEnabled(), { path: '/' });
    const autoscroll = $('#autoscroll_id').is(':checked') ? 'on' : 'off';
    Cookies.set('autoscroll', autoscroll, { path: '/' });

    let files = [];
    $('#file-container').children().each(function () {
        $(this).children('div[id^=div_viewer_]').each(function () {
            files = files.concat(findAllOpenedFiles($(this), '', $(this)[0].dataset.file_name, [], true));
        });
    });
    files = JSON.stringify(files);

    Cookies.set('files', files, { path: '/' });
    Cookies.set('cookie_version', cookie_version, { path: '/' });
}

// -----------------------------------------------------------------------------
// Student navigation

function waitForAllAjaxToComplete(callback) {
    const checkAjax = () => {
        if ($.active > 0) {
            setTimeout(checkAjax, 100);
        }
        else {
            callback();
        }
    };
    checkAjax();
}

function gotoMainPage() {
    const window_location = $('#main-page')[0].dataset.href;

    if (getGradeableId() !== '') {
        closeAllComponents(true).then(() => {
            waitForAllAjaxToComplete(() => {
                window.location = window_location;
            });
        }).catch(() => {
            if (confirm('Could not save open component, go to main page anyway?')) {
                window.location = window_location;
            }
        });
    }
    else {
        window.location = window_location;
    }
}

function gotoPrevStudent() {
    let filter;
    const navigate_assigned_students_only = localStorage.getItem('general-setting-navigate-assigned-students-only') !== 'false';

    const inquiry_status = Cookies.get('inquiry_status');
    if (inquiry_status === 'on') {
        filter = 'active-inquiry';
    }
    else {
        if (localStorage.getItem('general-setting-arrow-function') !== 'active-inquiry') {
            filter = localStorage.getItem('general-setting-arrow-function') || 'default';
        }
        else {
            filter = 'default';
        }
    }
    const selector = '#prev-student';
    let window_location = `${$(selector)[0].dataset.href}&filter=${filter}`;

    switch (filter) {
        case 'ungraded':
            window_location += `&component_id=${getFirstOpenComponentId()}`;
            break;
        case 'itempool':
            window_location += `&component_id=${getFirstOpenComponentId(true)}`;
            break;
        case 'ungraded-itempool':
            component_id = getFirstOpenComponentId(true);
            if (component_id === NO_COMPONENT_ID) {
                component_id = getFirstOpenComponentId();
            }
            break;
        case 'inquiry':
            window_location += `&component_id=${getFirstOpenComponentId()}`;
            break;
        case 'active-inquiry':
            window_location += `&component_id=${getFirstOpenComponentId()}`;
            break;
    }

    if (!navigate_assigned_students_only) {
        window_location += '&navigate_assigned_students_only=false';
    }

    if (getGradeableId() !== '') {
        closeAllComponents(true).then(() => {
            waitForAllAjaxToComplete(() => {
                window.location = window_location;
            });
        }).catch(() => {
            if (confirm('Could not save open component, change student anyway?')) {
                window.location = window_location;
            }
        });
    }
    else {
        window.location = window_location;
    }
}

function gotoNextStudent() {
    let filter;
    const navigate_assigned_students_only = localStorage.getItem('general-setting-navigate-assigned-students-only') !== 'false';

    const inquiry_status = Cookies.get('inquiry_status');
    if (inquiry_status === 'on') {
        filter = 'active-inquiry';
    }
    else {
        if (localStorage.getItem('general-setting-arrow-function') !== 'active-inquiry') {
            filter = localStorage.getItem('general-setting-arrow-function') || 'default';
        }
        else {
            filter = 'default';
        }
    }
    const selector = '#next-student';
    let window_location = `${$(selector)[0].dataset.href}&filter=${filter}`;

    switch (filter) {
        case 'ungraded':
            window_location += `&component_id=${getFirstOpenComponentId()}`;
            break;
        case 'itempool':
            window_location += `&component_id=${getFirstOpenComponentId(true)}`;
            break;
        case 'ungraded-itempool':
            component_id = getFirstOpenComponentId(true);
            if (component_id === NO_COMPONENT_ID) {
                component_id = getFirstOpenComponentId();
            }
            break;
        case 'inquiry':
            window_location += `&component_id=${getFirstOpenComponentId()}`;
            break;
        case 'active-inquiry':
            window_location += `&component_id=${getFirstOpenComponentId()}`;
            break;
    }

    if (!navigate_assigned_students_only) {
        window_location += '&navigate_assigned_students_only=false';
    }

    if (getGradeableId() !== '') {
        closeAllComponents(true).then(() => {
            waitForAllAjaxToComplete(() => {
                window.location = window_location;
            });
        }).catch(() => {
            if (confirm('Could not save open component, change student anyway?')) {
                window.location = window_location;
            }
        });
    }
    else {
        window.location = window_location;
    }
}
// Navigate to the prev / next student buttons
registerKeyHandler({ name: 'Previous Student', code: 'ArrowLeft' }, () => {
    gotoPrevStudent();
});
registerKeyHandler({ name: 'Next Student', code: 'ArrowRight' }, () => {
    gotoNextStudent();
});

// -----------------------------------------------------------------------------
// Panel show/hide
//

function resetSinglePanelLayout() {
    // hide all the two-panel-mode related nodes
    $('.two-panel-cont').removeClass('active');
    $('#two-panel-exchange-btn').removeClass('active');

    $('.panels-container').append('<h3 class="panel-instructions">Click above to select a panel for display</h3>');
    // Remove the full-left-column view (if it's currently present or is in-view) as it's meant for two-panel-mode only
    $('.two-panel-item.two-panel-left, .two-panel-drag-bar').removeClass('active');

    // remove the left bottom section and its drag bar
    $('.panel-item-section.left-bottom, .panel-item-section.right-bottom, .panel-item-section-drag-bar').removeClass('active');

    const leftTopPanelId = taLayoutDet.currentTwoPanels.leftTop;
    const leftBottomPanelId = taLayoutDet.currentTwoPanels.leftBottom;
    const rightTopPanelId = taLayoutDet.currentTwoPanels.rightTop;
    const rightBottomPanelId = taLayoutDet.currentTwoPanels.rightBottom;
    // Now Fetch the panels from DOM
    const leftTopPanel = document.getElementById(leftTopPanelId);
    const leftBottomPanel = document.getElementById(leftBottomPanelId);
    const rightTopPanel = document.getElementById(rightTopPanelId);
    const rightBottomPanel = document.getElementById(rightBottomPanelId);

    if (rightBottomPanel) {
        document.querySelector('.panels-container').append(rightBottomPanel);
        taLayoutDet.currentOpenPanel = rightBottomPanelId;
    }
    if (rightTopPanel) {
        document.querySelector('.panels-container').append(rightTopPanel);
        taLayoutDet.currentOpenPanel = rightTopPanelId;
    }
    if (leftBottomPanel) {
        document.querySelector('.panels-container').append(leftBottomPanel);
        taLayoutDet.currentOpenPanel = leftBottomPanelId;
    }
    if (leftTopPanel) {
        document.querySelector('.panels-container').append(leftTopPanel);
        taLayoutDet.currentOpenPanel = leftTopPanelId;
    }
    // current open panel will be either left or right panel from two-panel-mode
    // passing forceVisible = true, otherwise this method will just toggle it and it will get hidden
    taLayoutDet.isFullLeftColumnMode = false;
    setPanelsVisibilities(taLayoutDet.currentOpenPanel, true);
}

function checkForTwoPanelLayoutChange(isPanelAdded, panelId = null, panelPosition = null) {
    // update the global variable
    if (isPanelAdded) {
        taLayoutDet.currentTwoPanels[panelPosition] = panelId;
    }
    else {
        // panel is going to be removed from screen
        // check which one out of the left or right is going to be hidden
        if (taLayoutDet.currentTwoPanels.leftTop === panelId) {
            taLayoutDet.currentTwoPanels.leftTop = null;
        }
        else if (taLayoutDet.currentTwoPanels.leftBottom === panelId) {
            taLayoutDet.currentTwoPanels.leftBottom = null;
        }
        else if (taLayoutDet.currentTwoPanels.rightTop === panelId) {
            taLayoutDet.currentTwoPanels.rightTop = null;
        }
        else if (taLayoutDet.currentTwoPanels.rightBottom === panelId) {
            taLayoutDet.currentTwoPanels.rightBottom = null;
        }
    }
    saveTaLayoutDetails();
}

// Keep only those panels which are part of the two panel layout
function setMultiPanelModeVisiblities() {
    panelElements.forEach((panel) => {
        const id_str = document.getElementById(`#${panel.str}_btn`) ? `#${panel.str}_btn` : `#${panel.str}-btn`;

        if (taLayoutDet.currentTwoPanels.leftTop === panel.str
            || taLayoutDet.currentTwoPanels.leftBottom === panel.str
            || taLayoutDet.currentTwoPanels.rightTop === panel.str
            || taLayoutDet.currentTwoPanels.rightBottom === panel.str
        ) {
            $(`#${panel.str}`).toggle(true);
            $(panel.icon).toggleClass('icon-selected', true);
            $(id_str).toggleClass('active', true);
        }
        else {
            $(`#${panel.str}`).toggle(false);
            $(panel.icon).toggleClass('icon-selected', false);
            $(id_str).toggleClass('active', false);
        }
    });
}

function setPanelsVisibilities(ele, forceVisible = null, position = null) {
    panelElements.forEach((panel) => {
        const id_str = document.getElementById(`${panel.str}_btn`) ? `#${panel.str}_btn` : `#${panel.str}-btn`;
        if (panel.str === ele) {
            const eleVisibility = forceVisible !== null ? forceVisible : !$(`#${panel.str}`).is(':visible');
            $(`#${panel.str}`).toggle(eleVisibility);
            $(panel.icon).toggleClass('icon-selected', eleVisibility);
            $(id_str).toggleClass('active', eleVisibility);
            $(`#${panel.str}`).find('.CodeMirror').each(function () {
                this.CodeMirror.refresh();
            });

            if (taLayoutDet.numOfPanelsEnabled > 1 && !isMobileView) {
                checkForTwoPanelLayoutChange(eleVisibility, panel.str, position);
            }
            else {
                // update the global variable
                taLayoutDet.currentOpenPanel = eleVisibility ? panel.str : null;
                $('.panels-container > .panel-instructions').toggle(!taLayoutDet.currentOpenPanel);
            }
        }
        else if ((taLayoutDet.numOfPanelsEnabled && !isMobileView
            && taLayoutDet.currentTwoPanels.rightTop !== panel.str
            && taLayoutDet.currentTwoPanels.rightBottom !== panel.str
            && taLayoutDet.currentTwoPanels.leftTop !== panel.str
            && taLayoutDet.currentTwoPanels.leftBottom !== panel.str) || panel.str !== ele) {
            // only hide those panels which are not given panel and not in taLayoutDet.currentTwoPanels if the twoPanelMode is enabled
            $(`#${panel.str}`).hide();
            $(panel.icon).removeClass('icon-selected');
            $(id_str).removeClass('active');
        }
    });
    // update the two-panels-layout if it's enabled
    if (taLayoutDet.numOfPanelsEnabled > 1 && !isMobileView) {
        updatePanelLayoutModes();
    }
    else {
        saveTaLayoutDetails();
    }
}

function toggleFullScreenMode() {
    $('main#main').toggleClass('full-screen-mode');
    $('#fullscreen-btn-cont').toggleClass('active');
    taLayoutDet.isFullScreenMode = $('main#main').hasClass('full-screen-mode');

    // update the dragging event for two panels
    initializeResizablePanels(leftSelector, verticalDragBarSelector, false, saveResizedColsDimensions);
    // Save the taLayoutDetails in LS
    saveTaLayoutDetails();
}

function toggleFullLeftColumnMode(forceVal = false) {
    // toggle between the normal left and full left panel mode
    if (!forceVal) {
        taLayoutDet.isFullLeftColumnMode = !taLayoutDet.isFullLeftColumnMode;
    }

    const newPanelsContSelector = taLayoutDet.isFullLeftColumnMode ? '.content-items-container' : '.two-panel-cont';

    const leftPanelCont = document.querySelector(leftSelector);
    const dragBar = document.querySelector(verticalDragBarSelector);
    document.querySelector(newPanelsContSelector).prepend(leftPanelCont, dragBar);

    panelsContSelector = newPanelsContSelector;

    $('#grading-panel-student-name').hide();
}

/**
 *
 * @param panelsCount
 * @param isLeftTaller
 * @param twoOnRight
 */
function changePanelsLayout(panelsCount, isLeftTaller, twoOnRight = false) {
    taLayoutDet.numOfPanelsEnabled = +panelsCount;
    taLayoutDet.isFullLeftColumnMode = isLeftTaller;

    taLayoutDet.dividedColName = twoOnRight ? 'RIGHT' : 'LEFT';

    togglePanelLayoutModes(true);
    toggleFullLeftColumnMode(true);
    initializeResizablePanels(leftSelector, verticalDragBarSelector, false, saveResizedColsDimensions);
    initializeHorizontalTwoPanelDrag();
    togglePanelSelectorModal(false);
    if (!taLayoutDet.isFullLeftColumnMode) {
        $('#grading-panel-student-name').show();
    }
}

function togglePanelLayoutModes(forceVal = false) {
    const twoPanelCont = $('.two-panel-cont');
    if (!forceVal) {
        taLayoutDet.numOfPanelsEnabled = +taLayoutDet.numOfPanelsEnabled === 3 ? 1 : +taLayoutDet.numOfPanelsEnabled + 1;
    }

    if (taLayoutDet.numOfPanelsEnabled === 2 && !isMobileView) {
        twoPanelCont.addClass('active');
        $('#two-panel-exchange-btn').addClass('active');
        $('.panel-item-section.left-bottom, .panel-item-section.right-bottom, .panel-item-section-drag-bar').removeClass('active');
        $('.two-panel-item.two-panel-left, .two-panel-drag-bar').addClass('active');

        taLayoutDet.currentActivePanels = {
            leftTop: true,
            leftBottom: false,
            rightTop: true,
            rightBottom: false,
        };

        updatePanelLayoutModes();
    }
    else if (+taLayoutDet.numOfPanelsEnabled === 3 && !isMobileView) {
        twoPanelCont.addClass('active');
        $('.two-panel-item.two-panel-left, .two-panel-drag-bar').addClass('active');

        taLayoutDet.currentActivePanels = {
            leftTop: true,
            leftBottom: false,
            rightTop: true,
            rightBottom: false,
        };

        if (taLayoutDet.dividedColName === 'RIGHT') {
            $('.panel-item-section.left-bottom, .panel-item-section-drag-bar.panel-item-left-drag').removeClass('active');
            $('.panel-item-section.right-bottom, .panel-item-section-drag-bar.panel-item-right-drag').addClass('active');
            taLayoutDet.currentActivePanels.rightBottom = true;
        }
        else {
            $('.panel-item-section.right-bottom, .panel-item-section-drag-bar.panel-item-right-drag').removeClass('active');
            $('.panel-item-section.left-bottom, .panel-item-section-drag-bar.panel-item-left-drag').addClass('active');
            taLayoutDet.currentActivePanels.leftBottom = true;
        }

        initializeHorizontalTwoPanelDrag();
        updatePanelLayoutModes();
    }
    else if (+taLayoutDet.numOfPanelsEnabled === 4 && !isMobileView) {
        twoPanelCont.addClass('active');
        $('.two-panel-item.two-panel-left, .two-panel-drag-bar').addClass('active');

        taLayoutDet.currentActivePanels = {
            leftTop: true,
            leftBottom: true,
            rightTop: true,
            rightBottom: true,
        };

        $('.panel-item-section.right-bottom, .panel-item-section-drag-bar.panel-item-right-drag').addClass('active');
        $('.panel-item-section.left-bottom, .panel-item-section-drag-bar.panel-item-left-drag').addClass('active');

        initializeHorizontalTwoPanelDrag();
        updatePanelLayoutModes();
    }
    else {
        resetSinglePanelLayout();
        taLayoutDet.currentTwoPanels = {
            leftTop: null,
            leftBottom: null,
            rightTop: null,
            rightBottom: null,
        };
    }
    updatePanelOptions();
}

// Handles the DOM manipulation to update the two panel layout
function updatePanelLayoutModes() {
    // remove all panel instructions
    $('.panel-instructions').remove();
    setMultiPanelModeVisiblities();
    for (const panelIdx in panelsBucket) {
        const panelCont = document.querySelector(panelsBucket[panelIdx]).childNodes;
        // Move all the panels from the left and right buckets to the main panels-container
        for (let idx = 0; idx < panelCont.length; idx++) {
            document.querySelector('.panels-container').append(panelCont[idx]);
        }
    }

    // loop through panel positions (topLeft, topRight, etc)
    for (const panel in taLayoutDet.currentTwoPanels) {
        // if the panel isn't active, skip it
        if (!taLayoutDet.currentActivePanels[panel]) {
            continue;
        }
        const panel_type = taLayoutDet.currentTwoPanels[panel];
        // get panel corresponding with the layout position
        const layout_panel = $(`${panelsBucket[`${panel}Selector`]}`);
        // get panel corresponding with what the user selected to use for this spot (autograding, rubric, etc)
        const dom_panel = document.getElementById(`${panel_type}`);
        if (dom_panel) {
            $(layout_panel).append(dom_panel);
        }
        else {
            $(layout_panel).append('<h3 class="panel-instructions">Click above to select a panel for display</h3>');
        }
    }
    saveTaLayoutDetails();
}

// Exchanges positions of left and right panels
function exchangeTwoPanels() {
    if (+taLayoutDet.numOfPanelsEnabled === 2) {
        taLayoutDet.currentTwoPanels = {
            leftTop: taLayoutDet.currentTwoPanels.rightTop,
            rightTop: taLayoutDet.currentTwoPanels.leftTop,
        };
        updatePanelLayoutModes();
    }
    else if (+taLayoutDet.numOfPanelsEnabled === 3 || +taLayoutDet.numOfPanelsEnabled === 4) {
        taLayoutDet.currentTwoPanels = {
            leftTop: taLayoutDet.currentTwoPanels.rightTop,
            leftBottom: taLayoutDet.currentTwoPanels.rightBottom,
            rightTop: taLayoutDet.currentTwoPanels.leftTop,
            rightBottom: taLayoutDet.currentTwoPanels.leftBottom,
        };
        $('.panel-item-section.left-bottom, .panel-item-section.right-bottom, .panel-item-section-drag-bar').toggleClass('active');
        taLayoutDet.dividedColName = $('.panel-item-section.right-bottom').is(':visible') ? 'RIGHT' : 'LEFT';
        updatePanelOptions();
        updatePanelLayoutModes();
        initializeHorizontalTwoPanelDrag();
    }
    else {
        // taLayoutDet.numOfPanelsEnabled is 1
        alert('Exchange works only when there are two panels...');
    }
}

// Key handler / shorthand for toggling in between panels
registerKeyHandler({ name: 'Toggle Autograding Panel', code: 'KeyA' }, () => {
    $('#autograding_results_btn button').trigger('click');
    updateCookies();
});
registerKeyHandler({ name: 'Toggle Rubric Panel', code: 'KeyG' }, () => {
    $('#grading_rubric_btn button').trigger('click');
    updateCookies();
});
registerKeyHandler({ name: 'Toggle Submissions Panel', code: 'KeyO' }, () => {
    $('#submission_browser_btn button').trigger('click');
    updateCookies();
});
registerKeyHandler({ name: 'Toggle Student Information Panel', code: 'KeyS' }, () => {
    $('#student_info_btn button').trigger('click');
    updateCookies();
});
registerKeyHandler({ name: 'Toggle Grade Inquiry Panel', code: 'KeyX' }, () => {
    $('#grade_inquiry_info_btn button').trigger('click');
    updateCookies();
});
registerKeyHandler({ name: 'Toggle Discussion Panel', code: 'KeyD' }, () => {
    $('#discussion_browser_btn button').trigger('click');
    updateCookies();
});
registerKeyHandler({ name: 'Toggle Peer Panel', code: 'KeyP' }, () => {
    $('#peer_info_btn button').trigger('click');
    updateCookies();
});

registerKeyHandler({ name: 'Toggle Notebook Panel', code: 'KeyN' }, () => {
    $('#notebook-view-btn button').trigger('click');
    updateCookies();
});
registerKeyHandler({ name: 'Toggle Solution/TA-Notes Panel', code: 'KeyT' }, () => {
    $('#solution_ta_notes_btn button').trigger('click');
    updateCookies();
});
// -----------------------------------------------------------------------------
// Show/hide components

registerKeyHandler({ name: 'Open Next Component', code: 'ArrowDown' }, (e) => {
    const openComponentId = getFirstOpenComponentId();
    const numComponents = $('#component-list').find('.component-container').length;

    // Note: we use the 'toggle' functions instead of the 'open' functions
    //  Since the 'open' functions don't close any components
    if (openComponentId === NO_COMPONENT_ID) {
        // No component is open, so open the first one
        const componentId = getComponentIdByOrder(0);
        toggleComponent(componentId, true).then(() => {
            scrollToComponent(componentId);
        });
    }
    else if (openComponentId === getComponentIdByOrder(numComponents - 1)) {
        // Last component is open, close it and then open and scroll to first component
        closeComponent(openComponentId, true).then(() => {
            const componentId = getComponentIdByOrder(0);
            toggleComponent(componentId, true).then(() => {
                scrollToComponent(componentId);
            });
        });
    }
    else {
        // Any other case, open the next one
        const nextComponentId = getNextComponentId(openComponentId);
        toggleComponent(nextComponentId, true).then(() => {
            scrollToComponent(nextComponentId);
        });
    }
    e.preventDefault();
});

registerKeyHandler({ name: 'Open Previous Component', code: 'ArrowUp' }, (e) => {
    const openComponentId = getFirstOpenComponentId();
    const numComponents = $('#component-list').find('.component-container').length;

    // Note: we use the 'toggle' functions instead of the 'open' functions
    //  Since the 'open' functions don't close any components
    if (openComponentId === NO_COMPONENT_ID) {
        // No Component is open, so open the overall comment
        // Targets the box outside of the container, can use tab to focus comment
        // TODO: Add "Overall Comment" focusing, control
        scrollToOverallComment();
    }
    else if (openComponentId === getComponentIdByOrder(0)) {
        // First component is open, close it and then open and scroll to the last one
        closeComponent(openComponentId, true).then(() => {
            const componentId = getComponentIdByOrder(numComponents - 1);
            toggleComponent(componentId, true).then(() => {
                scrollToComponent(componentId);
            });
        });
    }
    else {
        // Any other case, open the previous one
        const prevComponentId = getPrevComponentId(openComponentId);
        toggleComponent(prevComponentId, true).then(() => {
            scrollToComponent(prevComponentId);
        });
    }
    e.preventDefault();
});

// -----------------------------------------------------------------------------
// Misc rubric options
registerKeyHandler({ name: 'Toggle Rubric Edit Mode', code: 'KeyE' }, () => {
    const editBox = $('#edit-mode-enabled');
    editBox.prop('checked', !editBox.prop('checked'));
    onToggleEditMode();
    updateCookies();
});

// -----------------------------------------------------------------------------
// Selecting marks

registerKeyHandler({ name: 'Select Full/No Credit Mark', code: 'Digit0' }, () => {
    checkOpenComponentMark(0);
});
registerKeyHandler({ name: 'Select Mark 1', code: 'Digit1' }, () => {
    checkOpenComponentMark(1);
});
registerKeyHandler({ name: 'Select Mark 2', code: 'Digit2' }, () => {
    checkOpenComponentMark(2);
});
registerKeyHandler({ name: 'Select Mark 3', code: 'Digit3' }, () => {
    checkOpenComponentMark(3);
});
registerKeyHandler({ name: 'Select Mark 4', code: 'Digit4' }, () => {
    checkOpenComponentMark(4);
});
registerKeyHandler({ name: 'Select Mark 5', code: 'Digit5' }, () => {
    checkOpenComponentMark(5);
});
registerKeyHandler({ name: 'Select Mark 6', code: 'Digit6' }, () => {
    checkOpenComponentMark(6);
});
registerKeyHandler({ name: 'Select Mark 7', code: 'Digit7' }, () => {
    checkOpenComponentMark(7);
});
registerKeyHandler({ name: 'Select Mark 8', code: 'Digit8' }, () => {
    checkOpenComponentMark(8);
});
registerKeyHandler({ name: 'Select Mark 9', code: 'Digit9' }, () => {
    checkOpenComponentMark(9);
});

function checkOpenComponentMark(index) {
    const component_id = getFirstOpenComponentId();
    if (component_id !== NO_COMPONENT_ID) {
        const mark_id = getMarkIdFromOrder(component_id, index);
        // TODO: Custom mark id is zero as well, should use something unique
        if (mark_id === CUSTOM_MARK_ID || mark_id === 0) {
            return;
        }
        toggleCommonMark(component_id, mark_id)
            .catch((err) => {
                console.error(err);
                alert(`Error toggling mark! ${err.message}`);
            });
    }
}

// expand all files in Submissions and Results section
function openAll(click_class, class_modifier) {
    const toClose = $(`#div_viewer_${$(`.${click_class}${class_modifier}`).attr('data-viewer_id')}`).hasClass('open');

    $('#submission_browser').find(`.${click_class}${class_modifier}`).each(function () {
        // Check that the file is not a PDF before clicking on it
        const viewerID = $(this).attr('data-viewer_id');
        if (($(this).parent().hasClass('file-viewer') && $(`#file_viewer_${viewerID}`).hasClass('shown') === toClose)
            || ($(this).parent().hasClass('div-viewer') && $(`#div_viewer_${viewerID}`).hasClass('open') === toClose)) {
            const innerText = Object.values($(this))[0].innerText;
            if (innerText.slice(-4) !== '.pdf') {
                $(this).click();
            }
        }
    });
}
function updateValue(obj, option1, option2) {
    // Switches the value of an element between option 1 and two
    obj.text((i, oldText) => {
        if (oldText.indexOf(option1) >= 0) {
            return oldText.replace(option1, option2);
        }
        else {
            return oldText.replace(option2, option1);
        }
    });
}
function openAutoGrading(num) {
    $(`#tc_${num}`).click();
    // eslint-disable-next-line eqeqeq
    if ($(`#testcase_${num}`)[0] != null) {
        $(`#testcase_${num}`)[0].style.display = 'block';
    }
}

function openDiv(num) {
    const elem = $(`#div_viewer_${num}`);
    if (elem.hasClass('open')) {
        elem.hide();
        elem.removeClass('open');
        $($($(elem.parent().children()[0]).children()[0]).children()[0]).removeClass('fa-folder-open').addClass('fa-folder');
    }
    else {
        elem.show();
        elem.addClass('open');
        $($($(elem.parent().children()[0]).children()[0]).children()[0]).removeClass('fa-folder').addClass('fa-folder-open');
    }
    return false;
}

// delta in this function is the incremental step of points, currently hardcoded to 0.5pts
function validateInput(id, question_total, delta) {
    const ele = $(`#${id}`);
    // eslint-disable-next-line eqeqeq
    if (isNaN(parseFloat(ele.val())) || ele.val() == '') {
        ele.val('');
        return;
    }
    if (ele.val() < 0 && parseFloat(question_total) > 0) {
        ele.val(0);
    }
    if (ele.val() > 0 && parseFloat(question_total) < 0) {
        ele.val(0);
    }
    if (ele.val() < parseFloat(question_total) && parseFloat(question_total) < 0) {
        ele.val(question_total);
    }
    if (ele.val() > parseFloat(question_total) && parseFloat(question_total) > 0) {
        ele.val(question_total);
    }
    // eslint-disable-next-line eqeqeq
    if (ele.val() % delta != 0) {
        ele.val(Math.round(ele.val() / delta) * delta);
    }
}

// autoresize the comment box
function autoResizeComment(e) {
    e.target.style.height = '';
    e.target.style.height = `${e.target.scrollHeight}px`;
}

function hideIfEmpty(element) {
    $(element).each(function () {
        if ($(this).hasClass('empty')) {
            $(this).hide();
        }
    });
}

function findOpenTestcases() {
    const testcase_num = [];
    let current_testcase;
    $('.box').each(function () {
        current_testcase = $(this).find('div[id^=testcase_]');
        if (typeof current_testcase[0] !== 'undefined') {
            if (current_testcase[0].style.display !== 'none') {
                testcase_num.push(parseInt(current_testcase.attr('id').split('_')[1]));
            }
        }
    });
    return testcase_num;
}

// finds all the open files and folder and stores them in stored_paths
function findAllOpenedFiles(elem, current_path, path, stored_paths, first) {
    if (first === true) {
        current_path += path;
        if ($(elem)[0].classList.contains('open')) {
            stored_paths.push(path);
        }
        else {
            return [];
        }
    }
    else {
        current_path += `#$SPLIT#$${path}`;
    }

    $(elem).children().each(function () {
        $(this).children('div[id^=file_viewer_]').each(function () {
            if ($(this)[0].classList.contains('shown')) {
                stored_paths.push((`${current_path}#$SPLIT#$${$(this)[0].dataset.file_name}`));
            }
        });
    });

    $(elem).children().each(function () {
        $(this).children('div[id^=div_viewer_]').each(function () {
            if ($(this)[0].classList.contains('open')) {
                stored_paths.push((`${current_path}#$SPLIT#$${$(this)[0].dataset.file_name}`));
                stored_paths = findAllOpenedFiles($(this), current_path, $(this)[0].dataset.file_name, stored_paths, false);
            }
        });
    });

    return stored_paths;
}

// Returns Non anonymized path for the submitted files by student
function getNonAnonPath(path, anon_submitter_id, user_ids) {
    let nonAnonPath = '';
    const pathPieces = path.split('/');
    for (let i = 1; i < pathPieces.length; i++) {
        // for non-anonymized-file-path, get the user-name from anon_submitter_id (if anonymized)
        if (i === 9) {
            nonAnonPath += `/${user_ids[anon_submitter_id]}`;
        }
        else {
            nonAnonPath += `/${pathPieces[i]}`;
        }
    }
    return nonAnonPath;
}

function changeCurrentPeer() {
    const peer = $('#edit-peer-select').val();
    $('.edit-peer-components-block').hide();
    $(`#edit-peer-components-form-${peer}`).show();
}

function clearPeerMarks(submitter_id, gradeable_id, csrf_token) {
    const peer_id = $('#edit-peer-select').val();
    const url = buildCourseUrl(['gradeable', gradeable_id, 'grading', 'clear_peer_marks']);
    $.ajax({
        url,
        data: {
            csrf_token,
            peer_id,
            submitter_id,
        },
        type: 'POST',
        success: function () {
            console.log('Successfully deleted peer marks');
            window.location.reload(true);
        },
        error: function () {
            console.log('Failed to delete');
        },
    });
}

function newEditPeerComponentsForm() {
    $('.popup-form').css('display', 'none');
    const form = $('#edit-peer-components-form');
    form.css('display', 'block');
    captureTabInModal('edit-peer-components-form');
}

function rotateImage(url, rotateBy) {
    let rotate = sessionStorage.getItem(`image-rotate-${url}`);
    if (rotate) {
        rotate = parseInt(rotate);
        if (isNaN(rotate)) {
            rotate = 0;
        }
    }
    else {
        rotate = 0;
    }
    if (rotateBy === 'cw') {
        rotate = (rotate + 90) % 360;
    }
    else if (rotateBy === 'ccw') {
        rotate = (rotate - 90) % 360;
    }
    $(`iframe[src="${url}"]`).each(function () {
        const img = $(this).contents().find('img');
        if (img && $(this).data('rotate') !== rotate) {
            $(this).data('rotate', rotate);
            if ($(this).data('observingImageResize') === undefined) {
                $(this).data('observingImageResize', false);
            }
            resizeImageIFrame(img, $(this));
            if ($(this).data('observingImageResize') === false) {
                const iFrameTarget = $(this);
                const observer = new ResizeObserver(() => {
                    resizeImageIFrame(img, iFrameTarget);
                });
                observer.observe($(this)[0]);
                $(this).data('observingImageResize', true);
            }
        }
    });
    sessionStorage.setItem(`image-rotate-${url}`, rotate);
}

function resizeImageIFrame(imageTarget, iFrameTarget) {
    if (imageTarget.parent().is(':visible')) {
        const rotateAngle = iFrameTarget.data('rotate');
        if (rotateAngle === 0) {
            imageTarget.css('transform', '');
        }
        else {
            imageTarget.css('transform', `rotate(${rotateAngle}deg)`);
        }
        imageTarget.css('transform', `translateY(${-imageTarget.get(0).getBoundingClientRect().top}px) rotate(${rotateAngle}deg)`);
        const iFrameBody = iFrameTarget.contents().find('body').first();
        const boundsHeight = iFrameBody[0].scrollHeight;
        let height = 500;
        if (iFrameTarget.css('max-height').length !== 0 && parseInt(iFrameTarget.css('max-height')) >= 0) {
            height = parseInt(iFrameTarget.css('max-height'));
        }
        if (boundsHeight > height) {
            iFrameBody.css('overflow-y', '');
            iFrameTarget.height(height);
        }
        else {
            iFrameBody.css('overflow-y', 'hidden');
            iFrameTarget.height(boundsHeight);
        }
    }
}

function imageRotateIcons(iframe) {
    const iframeTarget = $(`iframe#${iframe}`);
    const contentType = iframeTarget.contents().get(0).contentType;

    // eslint-disable-next-line eqeqeq
    if (contentType != undefined && contentType.startsWith('image')) {
        if (iframeTarget.attr('id').endsWith('_full_panel_iframe')) {
            const imageRotateBar = iframeTarget.parent().parent().parent().find('.image-rotate-bar').first();
            imageRotateBar.show();
            imageRotateBar.find('.image-rotate-icon-ccw').first().attr('onclick', `rotateImage('${iframeTarget.attr('src')}', 'ccw')`);
            imageRotateBar.find('.image-rotate-icon-cw').first().attr('onclick', `rotateImage('${iframeTarget.attr('src')}', 'cw')`);
            if (sessionStorage.getItem(`image-rotate-${iframeTarget.attr('src')}`)) {
                rotateImage(iframeTarget.attr('src'), 'none');
            }
        }
        else if (iframeTarget.parent().data('image-rotate-icons') !== true) {
            iframeTarget.parent().data('image-rotate-icons', true);
            iframeTarget.before(`<div class="image-rotate-bar">
                              <a class="image-rotate-icon-ccw" onclick="rotateImage('${iframeTarget.attr('src')}', 'ccw')">
                              <i class="fas fa-undo" title="Rotate image counterclockwise"></i></a>
                              <a class="image-rotate-icon-cw" onclick="rotateImage('${iframeTarget.attr('src')}', 'cw')">
                              <i class="fas fa-redo" title="Rotate image clockwise"></i></a>
                              </div>`);

            if (sessionStorage.getItem(`image-rotate-${iframeTarget.attr('src')}`)) {
                rotateImage(iframeTarget.attr('src'), 'none');
            }
        }
    }
}

function openFrame(html_file, url_file, num, pdf_full_panel = true, panel = 'submission') {
    const iframe = $(`#file_viewer_${num}`);
    const display_file_url = buildCourseUrl(['display_file']);
    if (!iframe.hasClass('open') || iframe.hasClass('full_panel')) {
        const iframeId = `file_viewer_${num}_iframe`;
        let directory = '';
        if (url_file.includes('user_assignment_settings.json')) {
            directory = 'submission_versions';
        }
        else if (url_file.includes('submissions')) {
            directory = 'submissions';
        }
        else if (url_file.includes('results_public')) {
            directory = 'results_public';
        }
        else if (url_file.includes('results')) {
            directory = 'results';
        }
        else if (url_file.includes('checkout')) {
            directory = 'checkout';
        }
        else if (url_file.includes('attachments')) {
            directory = 'attachments';
        }
        // handle pdf
        if (pdf_full_panel && url_file.substring(url_file.length - 3) === 'pdf') {
            viewFileFullPanel(html_file, url_file, 0, panel).then(() => {
                loadPDFToolbar();
            });
        }
        else {
            const forceFull = url_file.substring(url_file.length - 3) === 'pdf' ? 500 : -1;
            const targetHeight = iframe.hasClass('full_panel') ? 1200 : 500;
            const frameHtml = `
        <iframe id="${iframeId}" onload="resizeFrame('${iframeId}', ${targetHeight}, ${forceFull}); imageRotateIcons('${iframeId}');"
                src="${display_file_url}?dir=${encodeURIComponent(directory)}&file=${encodeURIComponent(html_file)}&path=${encodeURIComponent(url_file)}&ta_grading=true&gradeable_id=${$('#submission_browser').data('gradeable-id')}"
                width="95%">
        </iframe>
      `;
            iframe.html(frameHtml);
            iframe.addClass('open');
        }
    }
    if (!iframe.hasClass('full_panel') && (!pdf_full_panel || url_file.substring(url_file.length - 3) !== 'pdf')) {
        if (!iframe.hasClass('shown')) {
            iframe.show();
            iframe.addClass('shown');
            $($($(iframe.parent().children()[0]).children()[0]).children()[0]).removeClass('fa-plus-circle').addClass('fa-minus-circle');
        }
        else {
            iframe.hide();
            iframe.removeClass('shown');
            $($($(iframe.parent().children()[0]).children()[0]).children()[0]).removeClass('fa-minus-circle').addClass('fa-plus-circle');
        }
    }
    return false;
}

const fileFullPanelOptions = {
    submission: { // Main viewer (submission panel)
        viewer: '#viewer',
        fileView: '#file-view',
        gradingFileName: '#grading_file_name',
        panel: '#submission_browser',
        innerPanel: '#directory_view',
        pdfAnnotationBar: '#pdf_annotation_bar',
        saveStatus: '#save_status',
        fileContent: '#file-content',
        fullPanel: 'full_panel',
        imageRotateBar: '#image-rotate-icons-bar',
        pdf: true,
    },
    notebook: { // Notebook panel
        viewer: '#notebook-viewer',
        fileView: '#notebook-file-view',
        gradingFileName: '#notebook_grading_file_name',
        panel: '#notebook_view',
        innerPanel: '#notebook-main-view',
        pdfAnnotationBar: '#notebook_pdf_annotation_bar', // TODO
        saveStatus: '#notebook_save_status', // TODO
        fileContent: '#notebook-file-content',
        fullPanel: 'notebook_full_panel',
        imageRotateBar: '#notebook-image-rotate-icons-bar',
        pdf: false,
    },
};

function viewFileFullPanel(name, path, page_num = 0, panel = 'submission') {
    // debugger;
    if ($(fileFullPanelOptions[panel]['viewer']).length !== 0) {
        $(fileFullPanelOptions[panel]['viewer']).remove();
    }

    $(fileFullPanelOptions[panel]['imageRotateBar']).hide();

    const promise = loadPDF(name, path, page_num, panel);
    $(fileFullPanelOptions[panel]['fileView']).show();
    $(fileFullPanelOptions[panel]['gradingFileName']).html(name);
    const precision = $(fileFullPanelOptions[panel]['panel']).width() - $(fileFullPanelOptions[panel]['innerPanel']).width();
    const offset = $(fileFullPanelOptions[panel]['panel']).width() - precision;
    $(fileFullPanelOptions[panel]['innerPanel']).animate({ left: `+=${-offset}px` }, 200);
    $(fileFullPanelOptions[panel]['innerPanel']).hide();
    $(fileFullPanelOptions[panel]['fileView']).animate({ left: `+=${-offset}px` }, 200).promise();
    return promise;
}

function loadPDF(name, path, page_num, panel = 'submission') {
    // Store the file name of the last opened file for scrolling when switching between students
    localStorage.setItem('ta-grading-files-full-view-last-opened', name);
    const extension = name.split('.').pop();
    if (fileFullPanelOptions[panel]['pdf'] && extension === 'pdf') {
        const gradeable_id = document.getElementById(fileFullPanelOptions[panel]['panel'].substring(1)).dataset.gradeableId;
        const anon_submitter_id = document.getElementById(fileFullPanelOptions[panel]['panel'].substring(1)).dataset.anonSubmitterId;
        $('#pdf_annotation_bar').show();
        $('#save_status').show();
        return $.ajax({
            type: 'POST',
            url: buildCourseUrl(['gradeable', gradeable_id, 'grading', 'pdf']),
            data: {
                user_id: anon_submitter_id,
                filename: name,
                file_path: path,
                page_num: page_num,
                is_anon: true,
                csrf_token: csrfToken,
            },
            success: function (data) {
                $('#file-content').append(data);
            },
        });
    }
    else {
        $(fileFullPanelOptions[panel]['pdfAnnotationBar']).hide();
        $(fileFullPanelOptions[panel]['saveStatus']).hide();
        $(fileFullPanelOptions[panel]['fileContent']).append(`<div id="file_viewer_${fileFullPanelOptions[panel]['fullPanel']}" class="full_panel" data-file_name="" data-file_url=""></div>`);
        $(`#file_viewer_${fileFullPanelOptions[panel]['fullPanel']}`).empty();
        $(`#file_viewer_${fileFullPanelOptions[panel]['fullPanel']}`).attr('data-file_name', '');
        $(`#file_viewer_${fileFullPanelOptions[panel]['fullPanel']}`).attr('data-file_url', '');
        $(`#file_viewer_${fileFullPanelOptions[panel]['fullPanel']}`).attr('data-file_name', name);
        $(`#file_viewer_${fileFullPanelOptions[panel]['fullPanel']}`).attr('data-file_url', path);
        openFrame(name, path, fileFullPanelOptions[panel]['fullPanel'], false);
        $(`#file_viewer_${fileFullPanelOptions[panel]['fullPanel']}_iframe`).css('max-height', '1200px');
        // $("#file_viewer_" + fileFullPanelOptions[panel]["fullPanel"] + "_iframe").height("100%");
    }
}

function collapseFile(panel = 'submission') {
    // Removing these two to reset the full panel viewer.
    $(`#file_viewer_${fileFullPanelOptions[panel]['fullPanel']}`).remove();
    if (fileFullPanelOptions[panel]['pdf']) {
        $('#content-wrapper').remove();
        if ($('#pdf_annotation_bar').is(':visible')) {
            $('#pdf_annotation_bar').hide();
        }
    }
    $(fileFullPanelOptions[panel]['innerPanel']).show();
    const offset1 = $(fileFullPanelOptions[panel]['innerPanel']).css('left');
    const offset2 = $(fileFullPanelOptions[panel]['innerPanel']).width();
    $(fileFullPanelOptions[panel]['innerPanel']).animate({ left: `-=${offset1}` }, 200);
    $(fileFullPanelOptions[panel]['fileView']).animate({ left: `+=${offset2}px` }, 200, () => {
        $(fileFullPanelOptions[panel]['fileView']).css('left', '');
        $(fileFullPanelOptions[panel]['fileView']).hide();
    });
}

Twig.twig({
    id: 'Attachments',
    href: '/templates/grading/Attachments.twig',
    async: true,
});

let uploadedAttachmentIndex = 1;

function uploadAttachment() {
    const fileInput = $('#attachment-upload');
    if (fileInput[0].files.length === 1) {
        const formData = new FormData();
        formData.append('attachment', fileInput[0].files[0]);
        formData.append('anon_id', getAnonId());
        formData.append('csrf_token', csrfToken);
        let callAjax = true;
        const userAttachmentList = $('#attachments-list').children().first();
        const origAttachment = userAttachmentList.find(`[data-file_name='${CSS.escape(fileInput[0].files[0].name)}']`);
        if (origAttachment.length !== 0) {
            callAjax = confirm(`The file '${fileInput[0].files[0].name}' already exists; do you want to overwrite it?`);
        }
        if (callAjax) {
            fileInput.prop('disabled', true);
            $.ajax({
                url: buildCourseUrl(['gradeable', getGradeableId(), 'grading', 'attachments', 'upload']),
                type: 'POST',
                data: formData,
                contentType: false,
                processData: false,
                dataType: 'json',
                success: function (data) {
                    if (!('status' in data) || data['status'] !== 'success') {
                        alert(`An error has occurred trying to upload the attachment: ${data['message']}`);
                    }
                    else {
                        const renderedData = Twig.twig({
                            ref: 'Attachments',
                        }).render({
                            file: data['data'],
                            id: `a-up-${uploadedAttachmentIndex}`,
                            is_grader_view: true,
                            can_modify: true,
                        });
                        uploadedAttachmentIndex++;
                        if (origAttachment.length === 0) {
                            userAttachmentList.append(renderedData);
                        }
                        else {
                            origAttachment.first().parent().replaceWith(renderedData);
                        }
                        if (userAttachmentList.children().length === 0) {
                            userAttachmentList.css('display', 'none');
                            $('#attachments-header').css('display', 'none');
                        }
                        else {
                            userAttachmentList.css('display', '');
                            $('#attachments-header').css('display', '');
                        }
                    }
                    fileInput[0].value = '';
                    fileInput.prop('disabled', false);
                },
                error: function (jqXHR, textStatus, errorThrown) {
                    alert(`An error has occurred trying to upload the attachment: ${errorThrown}`);
                    fileInput[0].value = '';
                    fileInput.prop('disabled', false);
                },
            });
        }
        else {
            fileInput[0].value = '';
        }
    }
}

function deleteAttachment(target, file_name) {
    const confirmation = confirm(`Are you sure you want to delete attachment '${decodeURIComponent(file_name)}'?`);
    if (confirmation) {
        const formData = new FormData();
        formData.append('attachment', file_name);
        formData.append('anon_id', getAnonId());
        formData.append('csrf_token', csrfToken);
        $.ajax({
            url: buildCourseUrl(['gradeable', getGradeableId(), 'grading', 'attachments', 'delete']),
            type: 'POST',
            data: formData,
            contentType: false,
            processData: false,
            dataType: 'json',
            success: function (data) {
                if (!('status' in data) || data['status'] !== 'success') {
                    alert(`An error has occurred trying to delete the attachment: ${data['message']}`);
                }
                else {
                    $(target).parent().parent().remove();
                    const userAttachmentList = $('#attachments-list').children().first();
                    if (userAttachmentList.children().length === 0) {
                        userAttachmentList.css('display', 'none');
                        $('#attachments-header').css('display', 'none');
                    }
                    else {
                        userAttachmentList.css('display', '');
                        $('#attachments-header').css('display', '');
                    }
                }
            },
            error: function (jqXHR, textStatus, errorThrown) {
                alert(`An error has occurred trying to upload the attachment: ${errorThrown}`);
            },
        });
    }
}
$(document).ready(() => {
    $('#posts_list').css('min-width', '-webkit-fill-available');
    generateCodeMirrorBlocks(document);
    loadAllInlineImages(true);
});
