/**
 * Copyright (c) 2025 BridgeTech Inc.
 * Licensed under the MIT License.
 * See LICENSE file in the project root for full license information.
 * 
 * INESoftPhone 클래스는 Ipron SDK와 연동하여 소프트폰 UI를 제어하고 통화 기능을 수행합니다.
 */

function debounce(func, delay) {
    let timeoutId;
    return function(...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
}

class SoftPhoneUI {
    /** @type {object} */
    config = null;

    // UI 상태 및 버튼 키 상수를 정의합니다.
    static UI_STATE = {
        INIT:   "init",
        IDLE:   "idel",
        ALERT:  "alert",
        DIAL:   "dial",
        ACTIVE: "active",
        HOLD:   "hold",
    };

    static BUTTON_KEYS = {
        MAKE:       "make",
        HOLD:       "hold",
        UNHOLD:     "unhold",
        ANSWER:     "answer",
        DISCONNECT: "disconnect",
        TRANSFER:   "transfer",
        CONFERENCE: "conference",
        ETC:        "etc",
    };

    // 버튼 키에 해당하는 핸들러 메서드를 매핑합니다.
    buttonHandlers = {
        [SoftPhoneUI.BUTTON_KEYS.MAKE]: this.MakeCall,
        [SoftPhoneUI.BUTTON_KEYS.HOLD]: this.HoldCall,
        [SoftPhoneUI.BUTTON_KEYS.UNHOLD]: this.UnHoldCall,
        [SoftPhoneUI.BUTTON_KEYS.ANSWER]: this.AnswerCall,
        [SoftPhoneUI.BUTTON_KEYS.DISCONNECT]: this.EndCall,
        [SoftPhoneUI.BUTTON_KEYS.TRANSFER]: this.TransCall,
        [SoftPhoneUI.BUTTON_KEYS.CONFERENCE]: this.ConfCall,
        [SoftPhoneUI.BUTTON_KEYS.ETC]: this.EtcModeChange,
    };

    defConfig = {
        buttons: {
            make:       {id: "call"},
            hold:       {id: "hold"},
            unhold:     {id: "unhold"},
            answer:     {id: "answer"},
            disconnect: {id: "end"},
            transfer:   {id: "trans"},
            conference: {id: "conf"},
            etc:        {id: "etc"},
        },
        display: {
            maxbuttons: 4,
            moreButtonMode: false,
            visiblity: {
                init:   ["make", "hold",   "answer", "disconnect"],
                idel:   ["make", "hold",   "answer", "disconnect"],
                alert:  ["make", "hold",   "answer", "disconnect"],
                dial:   ["make", "hold",   "answer", "disconnect"],
                active: ["make", "hold",   "answer", "disconnect", "transfer", "conference"],
                hold:   ["make", "unhold", "answer", "disconnect", "transfer", "conference"],
            },
            enable: {
                init:   [],
                idel:   ["make"],
                alert:  ["answer", "disconnect"],
                dial:   ["disconnect"],
                active: ["make", "hold", "disconnect", "transfer", "conference"],
                hold:   ["make", "unhold", "disconnect", "transfer", "conference"],
            }
        },
        fn: {
            onMakeCall:   null,
            onHold:       null,
            onUnHold:     null,
            onAnswer:     null,
            onEndCall:    null,
            onTransfer:   null,
            onConference: null,
        }
    }

    constructor(el, config) {
        this.config = Object.assign({}, this.defConfig, config);
        this.dom_elements = {};

        // 설정된 버튼에 이벤트 리스너를 등록하고 DOM 요소를 캐시합니다.
        for (const key in this.config.buttons) {
            const buttonConfig = this.config.buttons[key];
            const el_btn = buttonConfig ? document.getElementById(buttonConfig.id) : null;
            
            if (el_btn) {
                this.dom_elements[key] = el_btn; // DOM 요소 캐시
                const handler = this.buttonHandlers[key];
                if (handler && typeof handler === 'function') {
                    // 화살표 함수를 사용하여 'this'가 INESoftPhone 인스턴스를 가리키도록 바인딩합니다.
                    el_btn.addEventListener('click', () => handler.call(this));
                }
            }
        }
        
        // Create a debounced version of the refresh logic
        this._debouncedInternalRefresh = debounce(this._internalRefreshCallBtn.bind(this), 100); // 100ms delay
        this.refreshCallBtn(SoftPhoneUI.UI_STATE.INIT); // Initial call
    }

    /********************
     * 화면 제어 함수
     ********************/

    // New method to contain the original logic
    _internalRefreshCallBtn(state) {
        if (!this.config?.buttons || !this.config.display?.visiblity || !this.config.display?.enable) {
            console.warn("Config for buttons or display states is missing.");
            return;
        }

        this.config.display.currentState = state;

        const visibleButtons = this.config.display.visiblity[state] || [];
        const enabledButtons = this.config.display.enable[state] || [];
        const moreButtonMode = this.config.display.moreButtonMode || false;
        let dispCount = 0;

        for (const key in this.config.buttons) {
            const buttonConfig = this.config.buttons[key];
            const el = this.dom_elements[key]; // 캐시된 요소 사용

            if (el) {

                // 상태에 따라 버튼 숨김/표시 설정
                let visible = visibleButtons.includes(key);
                if (visible) dispCount++;

                if (!moreButtonMode)
                    visible = visible && (this.config.display.maxbuttons >= dispCount);
                else 
                    visible = visible && (this.config.display.maxbuttons < dispCount);

                // 상태에 따라 버튼 활성화/비활성화 설정
                let enabled = enabledButtons.includes(key);

                el.hidden = !visible;
                el.disabled = !enabled;
            }
        }

        const el = this.dom_elements.etc; // 'etc' 버튼도 캐시에서 가져옴
        let etcVisible = (moreButtonMode || this.config.display.maxbuttons < dispCount);

        el.hidden = !etcVisible
        el.disabled = !etcVisible
    }

    setMoreButtonMode(enable) {
        this.config.display.moreButtonMode = enable
        this.refreshCallBtn(this.config.display.currentState);
    }

    /**
     * 현재 통화 상태에 따라 버튼의 표시 여부와 활성화 상태를 제어합니다.
     * @param {string} state - 현재 UI 상태 (INESoftPhone.UI_STATE 사용 권장)
     */
    refreshCallBtn(state) {
        // Call the debounced version
        this._debouncedInternalRefresh(state);
    }

    /********************
     * 버튼 호출 함수
     ********************/

    MakeCall() {
    	if (this.config.fn?.onMakeCall) this.config.fn.onMakeCall();
    }

    HoldCall() {
    	if (this.config.fn?.onHold) this.config.fn.onHold();
    }

    UnHoldCall() {
    	if (this.config.fn?.onUnHold) this.config.fn.onUnHold();
    }

    AnswerCall() {
    	if (this.config.fn?.onAnswer) this.config.fn.onAnswer();
    }

    EndCall() {
    	if (this.config.fn?.onEndCall) this.config.fn.onEndCall();
    }

    TransCall() {
    	if (this.config.fn?.onTransfer) this.config.fn.onTransfer();
    }

    ConfCall() {
    	if (this.config.fn?.onConference) this.config.fn.onConference();
    }

    EtcModeChange() {
        this.setMoreButtonMode(!this.config.display.moreButtonMode);
    }
}
