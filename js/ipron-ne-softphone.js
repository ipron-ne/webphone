/**
 * Copyright (c) 2025 BridgeTech Inc.
 * Licensed under the MIT License.
 * See LICENSE file in the project root for full license information.
 * 
 * INESoftPhone 클래스는 Ipron SDK와 연동하여 소프트폰 UI를 제어하고 통화 기능을 수행합니다.
 */

'use strict';

function debounce(func, delay) {
    let timeoutId;
    return function(...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
}

class INESoftPhone {
    /** @type {object} */
    config = null;

    /** @type {SessionManager} */
    session = null;

    // 에이전트 상태 상수를 정의합니다. (Ipron.AGENT_STATE와 매핑)
    static AGENT_STATUS = {
        LOGOUT:          "Logout",
        NOT_READY:       "NotReady",
        READY:           "Ready",
        IN_READY:        "InReady",
        OUT_READY:       "OutReady",
        AFTER_CALL_WORK: "AfterCallWork"
    };

    defConfig = {
        fn: {
            onLoginFail: null,
            onRegist: null,
            onUserStatusChanged: null,
            onCallStatusChanged: null,
            onUserInfoChanged: null,
            onMessage: null,
        }
    }


    /**
     * INESoftPhone 클래스의 새로운 인스턴스를 생성합니다.
     * @param {HTMLElement} el - 소프트폰 UI의 기본 요소 (현재 코드에서는 사용되지 않음)
     * @param {object} config - 소프트폰 설정을 포함하는 객체
     * @param {object} config.buttons - 각 버튼의 ID를 포함하는 객체
     * @param {object} config.display - 각 상태별 버튼 표시/활성화 설정을 포함하는 객체
     * @param {object} config.fn - 콜백 함수를 포함하는 객체
     */
    constructor(el, config) {
        this.config = Object.assign({}, this.defConfig, config);
        this.session = new INESoftPhone.SessionManager(); // SessionManager 인스턴스 생성

        // Debounce UI-updating callbacks if they are provided
        if (this.config.fn.onCallStatusChanged) {
            this._debouncedOnCallStatusChanged = debounce(this.config.fn.onCallStatusChanged, 100); // 100ms delay
        }
        if (this.config.fn.onUserStatusChanged) {
            this._debouncedOnUserStatusChanged = debounce(this.config.fn.onUserStatusChanged, 100);
        }

        this.refreshCallStatus(); // 콜 상태 표시

    }

    /********************
     * 화면 메시지 출력 함수
     ********************/

    /**
     * 통화 상태 메시지를 업데이트합니다.
     * @param {string} msg - 표시할 통화 상태 메시지
     */
    setCallStatus(status) {
        if (this._debouncedOnCallStatusChanged) {
            this._debouncedOnCallStatusChanged(status);
        } else if (this.config?.fn?.onCallStatusChanged) { // Fallback if not debounced (e.g. no callback provided)
            this.config.fn.onCallStatusChanged(status);
        }
    }

    /**
     * 사용자 상태를 업데이트합니다.
     * @param {string} status - 표시할 사용자 상태
     */
    setUserStatus(status) {
       if (this._debouncedOnUserStatusChanged) {
            this._debouncedOnUserStatusChanged(status);
        } else if (this.config?.fn?.onUserStatusChanged) { // Fallback
            this.config.fn.onUserStatusChanged(status);
        }
    }

    /**
     * 사용자 정보를 업데이트합니다.
     * @param {string} user - 사용자 이름
     * @param {string} dn - 사용자 DN (Directory Number)
     */
    setUserInfo(user, dn) {
        if (this.config?.fn?.onUserInfoChanged) {
            this.config.fn.onUserInfoChanged(user, dn);
        }
    }

    /**
     * 소프트폰 등록(로그인) 상태 변경 시 호출됩니다.
     * @param {boolean} state - 등록 상태 (true: 등록됨, false: 등록 해제)
     */
    setRegisterStatus(state) {
        if (this.config?.fn?.onRegist) {
            this.config.fn.onRegist(state);
        }
    }

    setMessage(msg) {
        if (this.config?.fn?.onMessage) {
            this.config.fn.onMessage(msg);
        }
    }

    /********************
     * 화면 제어 함수
     ********************/

    /**
     * 통화 상태 변경 시 UI를 업데이트합니다.
     */
    refreshCallStatus() {
        // 세션 TID가 없으면(로그인 전) 상태를 미등록으로 표시
        if (this.session.tid === "") {
            this.setCallStatus("unregi");
            return;
        }

        this.setCallStatus(this.session.getActiveCallStatus());
    }

    /********************
     * 기타 호출 함수
     ********************/

    /**
     * 에이전트 상태를 변경합니다.
     * @param {string} status - 변경할 에이전트 상태 (AGENT_STATUS 상수에 정의된 문자열)
     */
    AgentStatusChange(status) {
        if (!this.session.isLogin()) {
            console.warn("Agent not logged in. Cannot change status.");
            return;
        }

        let ipronStatus = null;
        let ipronCause = "";

        switch (status) {
            case INESoftPhone.AGENT_STATUS.LOGOUT:
                // 로그아웃은 별도 함수 호출
                this.logoutAgent(this.session.tid, this.session.uid, "workoff");
                return; // LogoutAgent가 UnInit을 호출하므로 여기서 종료
            case INESoftPhone.AGENT_STATUS.NOT_READY:
                ipronStatus = Ipron.AGENT_STATE.NOTREADY;
                ipronCause = Ipron.AGENT_STATE_CAUSE.IDLE;
                break;
            case INESoftPhone.AGENT_STATUS.READY:
                ipronStatus = Ipron.AGENT_STATE.READY;
                ipronCause = "";
                break;
            case INESoftPhone.AGENT_STATUS.IN_READY:
                ipronStatus = Ipron.AGENT_STATE.INREADY;
                ipronCause = "";
                break;
            case INESoftPhone.AGENT_STATUS.OUT_READY:
                ipronStatus = Ipron.AGENT_STATE.OUTREADY;
                ipronCause = "";
                break;
            case INESoftPhone.AGENT_STATUS.AFTER_CALL_WORK:
                ipronStatus = Ipron.AGENT_STATE.AFTERWORK;
                ipronCause = "02"; // 예시 CAUSE 코드
                break;
            default:
                console.warn("Unknown agent status requested:", status);
                return;
        }

        if (ipronStatus) {
            this.setAgentStatus(this.session.tid, this.session.uid, ipronStatus, ipronCause);
        }
    }

    /********************
     * 정보 제공 함수
     ********************/

    /**
     * 에이전트가 로그인 상태인지 확인합니다.
     * @returns {boolean} 로그인 상태 여부
     */
    IsLogin() {
        return this.session.isLogin();
    }

    /********************
     * 콜 제어 함수
     ********************/

    /**
     * 전화를 발신합니다.
     */
    MakeCall(numTel) {
        if (!numTel) {
            console.warn("Dial number is empty.");
            return;
        }
        if (!this.session.isLogin()) {
             console.warn("Agent not logged in. Cannot make call.");
             return;
        }

        this.Call(this.session.tid, this.session.uid, this.session.dn, numTel, "");
        // return false; // UI 이벤트 핸들러가 아니므로 반환값은 불필요
    }

    /**
     * 걸려온 전화를 수신합니다.
     */
    AnswerCall() {
        const activeCall = this.session.getActiveCall();
        if (!activeCall) {
            console.warn("No active call to answer.");
            return;
        }
        this.Answer(this.session.tid, activeCall.callid, activeCall.connid);
    }

    /**
     * 현재 통화를 보류합니다.
     */
    HoldCall() {
         const activeCall = this.session.getActiveCall();
        if (!activeCall) {
            console.warn("No active call to hold.");
            return;
        }
        this.Hold(this.session.tid, activeCall.callid, activeCall.connid);
    }

    /**
     * 보류된 통화를 해제합니다.
     */
    UnHoldCall() {
         const activeCall = this.session.getActiveCall();
        if (!activeCall) {
            console.warn("No active call to unhold.");
            return;
        }
        this.UnHold(this.session.tid, activeCall.callid, activeCall.connid);
    }

    /**
     * 현재 통화를 종료합니다.
     */
    EndCall() {
        const activeCall = this.session.getActiveCall();
        if (!activeCall) {
            console.warn("No active call to end.");
            return;
        }
        this.Release(this.session.tid, activeCall.callid, activeCall.connid);
        console.log("end call requested");
    }

    /**
     * 통화를 전환합니다. (Single Step 또는 Mute Transfer)
     * 원본 코드의 로직 (activeCall() == 0 또는 1)은 활성 통화 인덱스를 기준으로 판단하는 것으로 보이며,
     * 통화가 1개일 때 SSTransfer, 통화가 2개이고 활성 통화가 두 번째(인덱스 1)일 때 MuteTransfer를 시도합니다.
     * 이 로직은 통화 관리 방식에 따라 다를 수 있으므로 주의가 필요합니다.
     */
    TransCall(dialNum) {
        if (!dialNum) {
             console.warn("Dial number is required for transfer.");
             return;
        }

        const activeCall = this.session.getActiveCall();
        const holdCall = this.session.getHoldCall(); // Assume getHoldCall returns the call intended for transfer target

        // 원본 로직을 따르지만, getActiveCallIndex()를 사용하여 의미를 명확히 합니다.
        if (this.session.getActiveCallIndex() === 0 && activeCall) {
            // 활성 통화가 하나일 때 (또는 첫 번째일 때) Single Step Transfer 시도
            console.log("Attempting Single Step Transfer...");
            this.SSTransfer(this.session.tid, activeCall.callid, activeCall.connid, dialNum);
        } else if (this.session.getActiveCallIndex() === 1 && activeCall && holdCall) {
            // 활성 통화가 두 번째이고 (보류된) 다른 통화가 있을 때 Mute Transfer 시도
            console.log("Attempting Mute Transfer...");
            this.Transfer(this.session.tid, holdCall.callid, holdCall.connid, activeCall.callid);
        } else {
            console.warn("Transfer failed: Invalid call state for transfer or missing dial number.");
        }
    }

    /**
     * 통화를 컨퍼런스합니다. (Single Step 또는 Mute Conference)
     * 원본 코드의 로직 (activeCall() == 0 또는 1)은 활성 통화 인덱스를 기준으로 판단하는 것으로 보이며,
     * 통화가 1개일 때 SSConference, 통화가 2개이고 활성 통화가 두 번째(인덱스 1)일 때 MuteConference를 시도합니다.
     * 이 로직은 통화 관리 방식에 따라 다를 수 있으므로 주의가 필요합니다.
     */
    ConfCall(dialNum) {
         const activeCall = this.session.getActiveCall();
         const holdCall = this.session.getHoldCall(); // Assume getHoldCall returns the call intended for conference party

        // 원본 로직을 따르지만, getActiveCallIndex()를 사용하여 의미를 명확히 합니다.
        if (this.session.getActiveCallIndex() === 0 && activeCall && dialNum) {
            // 활성 통화가 하나일 때 (또는 첫 번째일 때) Single Step Conference 시도
            console.log("Attempting Single Step Conference...");
             this.SSConference(this.session.tid, activeCall.callid, activeCall.connid, dialNum, "holdmoh"); // "holdmoh"는 SDK에 따라 다를 수 있음
        } else if (this.session.getActiveCallIndex() === 1 && activeCall && holdCall) {
            // 활성 통화가 두 번째이고 (보류된) 다른 통화가 있을 때 Mute Conference 시도
             console.log("Attempting Mute Conference...");
            this.Conference(this.session.tid, holdCall.callid, holdCall.connid, activeCall.callid, "party"); // "party"는 SDK에 따라 다를 수 있음
        } else {
             console.warn("Conference failed: Invalid call state for conference or missing dial number.");
        }
    }


    /**
     * jsSIP implement (SDK 연동 부분 - Ipron SDK 가정)
     */

    /**
     * 에이전트 로그인을 수행합니다.
     * @param {string} server - 서버 주소
     * @param {string} port - 서버 포트
     * @param {string} tenant - 테넌트 ID
     * @param {string} userId - 사용자 ID
     * @param {string} passwd - 비밀번호
     * @param {string} dn - DN (Directory Number)
     * @returns {Promise<void>}
     */
    async Login(url, tenant, userId, passwd, dn) {
        const baseUrl = `${url}`; // 프로토콜은 http로 하드코딩되어 있음
        const timeout = 5000; // 예시 타임아웃 값
        const isDebug = true; // 예시 디버그 설정

        this.setRegisterStatus(false); // 초기 등록 해제 상태로 설정
        this.setCallStatus("");
        this.setUserInfo("", "");
        this.session.reset(); // 등록 해제 시 세션 정보 초기화

        if (typeof Ipron === 'undefined') {
             console.error("Ipron SDK is not loaded.");
             this.setMessage("SDK not found");
             return;
        }

        try {
            // SDK 초기화는 한 번만 수행해야 할 수 있습니다.
            // 이미 초기화된 경우 Ipron.init을 다시 호출하는 것이 안전한지는 SDK 문서 확인 필요
            console.log(`Initializing Ipron SDK with baseUrl: ${baseUrl}`);
            Ipron.instance = null;
            Ipron.init(baseUrl, timeout, isDebug);
        } catch (e) {
            console.error("Ipron SDK initialization failed:", e);
            this.setMessage("Init fail");
            return;
        }

        // SDK 이벤트 콜백 함수 정의
        const eventCallback = (e) => {
            // 이벤트 객체 구조에 따라 e.data에 접근
            if (e && e.data && e.data.event) {
                 this.EventHandler(e.data.event, e.data);
                 this.EmmitEvent(e);
            } else {
                 console.warn("Received event with unexpected structure:", e);
            }
        };

        try {
            // LoginAgent SDK 호출
            const response = await this.loginAgent(
                userId, passwd, tenant,
                [Ipron.MEDIA_TYPE.VOICE], // 미디어 타입 설정
                Ipron.AGENT_STATE.NOTREADY, // 초기 에이전트 상태 설정
                "", // 초기 상태 원인 설정
                dn,
                eventCallback
            );

            if (response?.result) {
                // 로그인 성공 처리
                const userInfo = Ipron.util.decodeJWT(response.data.accessToken);
                console.log("Login successful. User Info:", userInfo);

                // 세션 정보 업데이트
                this.session.tid = userInfo.tntId;
                this.session.uid = userInfo._id;
                this.session.uname = userInfo.name;
                this.session.email = userInfo.email;
                this.session.refreshToken = response.data.refreshToken;
                this.session.dn = dn; // 로그인 시 받은 DN으로 업데이트

                this.setRegisterStatus(true); // 등록 성공 상태로 설정
                this.setUserStatus(Ipron.AGENT_STATE.LOGIN)
                this.setCallStatus("Idel");
                this.setUserInfo(`${this.session.uname} [${this.session.email}]`, this.session.dn);

                // 추가 정보 조회 (비동기 병렬 처리)
                await Promise.all([
                    this.GetAgentInfo(this.session.tid, this.session.uid),
                    this.GetAgentStatus(this.session.tid, this.session.uid)
                ]);

                // UI 상태 업데이트
                this.setUserStatus(this.session.presenceStatus); // GetAgentStatus에서 업데이트됨
                this.refreshCallStatus(); // 통화 상태 UI 업데이트 (로그인 시점에는 보통 IDLE)

                // 이벤트 모니터링 시작 (필요시 주석 해제)
                // this.StartUserEventMonitor()

            } else {
                // 로그인 실패 처리
                console.error("Login failed:", response?.msg || "Unknown reason");
                this.setMessage(`Login fail: ${response?.msg || "Unknown"}`);
                this.config.fn.onLoginFail(response?.msg || "Unknown")
            }
        } catch (error) {
            console.error("Login process error:", error);
            this.setMessage(`Login error: ${error.message || "Unknown"}`);
            this.config.fn.onLoginFail(error)
        }
    }

    /**
     * 에이전트 로그아웃을 수행합니다.
     * @returns {Promise<void>}
     */
    async Logout() {
        if (!this.session.isLogin()) {
            console.warn("Agent not logged in. Cannot logout.");
            this.setMessage("Not logged in");
            this.setUserStatus(Ipron.AGENT_STATE.LOGOUT)
            return;
        }
        try {
            await this.logoutAgent(this.session.tid, this.session.uid, "workoff");
        } catch (error) {
            console.error("LogoutAgent SDK call failed:", error);
            // 로그아웃 SDK 호출 실패하더라도 내부 상태는 초기화 시도
        } finally {
            this.UnInit(); // 내부 상태 초기화
            this.refreshCallStatus(); // UI 업데이트 (미등록 상태로)
            this.setUserStatus(Ipron.AGENT_STATE.LOGOUT)
        }
    }

    /**
     * 소프트폰 내부 상태를 초기화합니다.
     */
    UnInit() {
        this.setRegisterStatus(false); // UI 등록 해제 상태로 설정
        this.setCallStatus("");
        this.setMessage("");
        this.setUserInfo("", "");

        // this.StopUserEventMonitor() // 이벤트 모니터링 중지 (필요시 주석 해제)

        this.session.reset(); // 세션 정보 초기화

        console.log("INESoftPhone uninitialized.");
    }

    /*******************
     * SDK API 호출부 (async/await 패턴 유지)
     *******************/

    /**
     * 에이전트 정보를 조회합니다.
     * @param {string} tId - 테넌트 ID
     * @param {string} userId - 사용자 ID
     * @returns {Promise<object>} SDK 응답 객체
     */
    async GetAgentInfo(tId, userId) {
        try {
            const result = await Ipron.info.getAgentInfo(tId, userId);
            if (result?.result) {
                console.log(`getAgentInfo success for ${userId}: ${result.data.name}`);
                // this.session.dn = result.data.extension; // 필요시 DN 업데이트
            } else {
                console.warn("getAgentInfo failed:", result?.msg || "Unknown error");
            }
            return result;
        } catch (error) {
            console.error("Error calling getAgentInfo:", error);
            throw error; // 에러를 다시 던져서 상위 호출자가 처리하게 할 수 있습니다.
        }
    }

    /**
     * 에이전트 현재 상태를 조회하고 세션에 업데이트합니다.
     * @param {string} tId - 테넌트 ID
     * @param {string} userId - 사용자 ID
     * @returns {Promise<object>} SDK 응답 객체
     */
    async GetAgentStatus(tId, userId) {
        try {
            const result = await Ipron.presence.getUserState(tId, userId, Ipron.MEDIA_TYPE.VOICE);
            if (result?.result && result.stateset && result.stateset.length > 0) {
                this.session.presenceStatus = result.stateset[0]; // 첫 번째 미디어 상태 사용
                console.log(`getUserState success for ${userId}. State: ${this.session.presenceStatus}, Cause: ${result.causeset?.[0]}`);
            } else {
                console.warn("getUserState failed:", result?.msg || "No state data");
                this.session.presenceStatus = "Unknown"; // 상태 조회 실패 시
            }
            return result;
        } catch (error) {
             console.error("Error calling getUserState:", error);
             this.session.presenceStatus = "Error"; // 에러 발생 시
             throw error;
        }
    }

    /**
     * Ipron SDK의 Login Agent API를 호출합니다.
     * @param {string} userId
     * @param {string} pass
     * @param {string} tenant
     * @param {string[]} mediaSet
     * @param {string} status
     * @param {string} cause
     * @param {string} dn
     * @param {function} cb - 이벤트 콜백 함수
     * @returns {Promise<object>} SDK 응답 객체
     */
    async loginAgent(userId, pass, tenant, mediaSet, status, cause, dn, cb) {
        try {
             console.log(`Calling Ipron.oauth2.login for user: ${userId}`);
            const result = await Ipron.oauth2.login(userId, pass, tenant, mediaSet, status, cause, dn, cb);
            if (!result?.result) {
                console.warn("Ipron.oauth2.login failed:", result?.msg || "Unknown error");
            } else {
                 console.log("Ipron.oauth2.login successful.");
            }
            return result;
        } catch (error) {
            console.error("Error calling Ipron.oauth2.login:", error);
            // API 호출 자체의 에러는 여기서 throw
            throw error;
        }
    }

    /**
     * Ipron SDK의 Logout Agent API를 호출합니다.
     * @param {string} tId - 테넌트 ID
     * @param {string} userId - 사용자 ID
     * @param {string} cause - 로그아웃 원인
     * @returns {Promise<object>} SDK 응답 객체
     */
    async logoutAgent(tId, userId, cause) {
        try {
            console.log(`Calling Ipron.oauth2.logout for user: ${userId}`);
            const result = await Ipron.oauth2.logout(tId, userId, [Ipron.MEDIA_TYPE.VOICE], cause);
            if (!result?.result) {
                console.warn("Ipron.oauth2.logout failed:", result?.msg || "Unknown error");
            } else {
                console.log("Ipron.oauth2.logout successful.");
            }
             return result;
        } catch (error) {
            console.error("Error calling Ipron.oauth2.logout:", error);
            throw error;
        }
    }

    /**
     * 에이전트 상태를 설정합니다.
     * @param {string} tId - 테넌트 ID
     * @param {string} userId - 사용자 ID
     * @param {string} status - 변경할 상태 (Ipron.AGENT_STATE 값)
     * @param {string} cause - 상태 원인 (Ipron.AGENT_STATE_CAUSE 값)
     * @returns {Promise<object>} SDK 응답 객체
     */
    async setAgentStatus(tId, userId, status, cause) {
        try {
            console.log(`Calling Ipron.presence.setUserState for user: ${userId} to status: ${status}`);
            const result = await Ipron.presence.setUserState(tId, userId, [Ipron.MEDIA_TYPE.VOICE], status, cause);
            if (!result?.result) {
                console.warn("Ipron.presence.setUserState failed:", result?.msg || "Unknown error");
            } else {
                 console.log("Ipron.presence.setUserState successful.");
                 this.session.presenceStatus = status; // 상태 변경 성공 시 세션 상태 업데이트
                 this.setUserStatus(status); // UI 상태 업데이트
            }
             return result;
        } catch (error) {
            console.error("Error calling Ipron.presence.setUserState:", error);
            throw error;
        }
    }

    /**
     * 통화의 사용자 데이터를 조회합니다.
     * @param {string} tId - 테넌트 ID
     * @param {string} callId - 통화 ID
     * @returns {Promise<object>} SDK 응답 객체
     */
    async getUserData(tId, callId) {
        try {
            console.log(`Calling Ipron.call.getUserdata for callId: ${callId}`);
            const result = await Ipron.call.getUserdata(tId, callId);
            // console.log("getUserdata result: ", result); // 원본 로깅 유지
            if (!result?.result) {
                console.warn("Ipron.call.getUserdata failed:", result?.msg || "Unknown error");
            } else {
                 console.log("Ipron.call.getUserdata successful.");
                 // 여기서 사용자 데이터 처리 로직 추가 가능
            }
             return result;
        } catch (error) {
             console.error("Error calling Ipron.call.getUserdata:", error);
             throw error;
        }
    }

    /*******************
     * 이벤트 처리부
     *******************/

    /**
     * 외부 (부모 창 등)로 이벤트를 전달합니다.
     * @param {object} e - 전달할 이벤트 객체
     */
    EmmitEvent(e) {
        // window.parent가 존재하는지 확인하여 오류 방지
        if (window.parent) {
            window.parent.postMessage({ event: 'event', data: e }, "*");
        } else {
            console.warn("window.parent is not available. Cannot emit event.");
        }
    }

    /**
     * Ipron SDK 이벤트를 처리합니다.
     * @param {string} event - 이벤트 타입 문자열 (Ipron.EVENT.TYPE 값)
     * @param {object} e - 이벤트 데이터 객체
     */
    EventHandler(event, e) {
        let stateChanged = false; // UI 상태 변경 여부 플래그

        console.log(`Handling Ipron event: ${event}`, e);

        // 현재 사용자의 이벤트인지 확인 (epId 또는 eventEpId 사용)
        let isCurrentUserEvent = (e.epId === this.session.uid || e.eventEpId === this.session.uid);

        switch (event) {
            case Ipron.EVENT.TYPE.PHONE?.BUSY: // ?.를 사용하여 Ipron.EVENT.TYPE.PHONE이 없을 경우 에러 방지
                // 전화기 BUSY 상태 이벤트 처리
                // console.log('Phone Busy:', e.data.phoneId);
                break;
            case 'event.userassignchanged': // 사용자 할당 변경 (커스텀 이벤트일 수 있음)
                // 해당 이벤트 발생 시 사용자 상태 변경 처리
                if (e.newState) {
                    this.setUserStatus(e.newState);
                    this.session.presenceStatus = e.newState;
                    stateChanged = true; // UI 상태 변경 필요
                }
                break;
            case Ipron.EVENT.TYPE.USER?.USERSTATECHANGED: // 사용자 상태 변경
                isCurrentUserEvent = (e.userId === this.session.uid);
                // 해당 이벤트 발생 시 사용자 상태 변경 처리
                if (isCurrentUserEvent && e.newState) {
                    this.setUserStatus(e.newState);
                    this.session.presenceStatus = e.newState;
                    stateChanged = true; // UI 상태 변경 필요
                }
                break;
            case Ipron.EVENT.TYPE.CALL?.ALERTING: // 통화 연결 시도 (벨 울림)
                // 현재 사용자의 통화 알림이고, 세션에 없는 새 통화인 경우 추가
                if (isCurrentUserEvent && !this.session.findCall(e.callId, e.connId)) {
                    this.session.addCall(e.callId, e.connId);
                    this.session.setCallStatus(e.callId, e.connId, e.connNewState);
                    stateChanged = true; // UI 상태 변경 필요 (예: Ringing)
                }
                console.log('Call Alerting - status:', e.connNewState);
                break;
            case Ipron.EVENT.TYPE.CALL?.CONNECTED: // 통화 연결됨
                 // 현재 사용자의 통화 연결 이벤트 발생 시 상태 업데이트
                 if (isCurrentUserEvent) {
                     this.session.setCallStatus(e.callId, e.connId, e.connNewState);
                     stateChanged = true; // UI 상태 변경 필요 (예: Connected)

                     if (e.partyCnt > 2) {
                         console.log('Call is now a conference with party count:', e.partyCnt);
                     } else {
                         console.log('Call Connected.');
                     }
                 }
                break;
            case Ipron.EVENT.TYPE.CALL?.HOLD: // 통화 보류됨
                 // 현재 사용자의 통화 보류 이벤트 발생 시 상태 업데이트
                 if (isCurrentUserEvent) {
                     this.session.setCallStatus(e.callId, e.connId, e.connNewState);
                     stateChanged = true; // UI 상태 변경 필요 (예: Hold)
                     console.log('Call Held.');
                 }
                break;
            case Ipron.EVENT.TYPE.CALL?.UNHOLD: // 통화 보류 해제됨
                 // 현재 사용자의 통화 보류 해제 이벤트 발생 시 상태 업데이트
                 if (isCurrentUserEvent) {
                     this.session.setCallStatus(e.callId, e.connId, e.connNewState);
                     stateChanged = true; // UI 상태 변경 필요 (예: Active)
                     console.log('Call Unheld.');
                 }
                break;
            case Ipron.EVENT.TYPE.CALL?.DISCONNECTED: // 통화 끊어짐
                 // 현재 사용자의 통화 끊김 이벤트 발생 시 세션에서 통화 제거
                 if (isCurrentUserEvent) {
                     this.session.delCall(e.callId, e.connId);
                     stateChanged = true; // UI 상태 변경 필요 (예: IDLE)
                     console.log('Call Disconnected.');
                 }
                break;
            case Ipron.EVENT.TYPE.CALL?.PARTYCHANGED: // 통화 참여자 변경 (Transfer, Conference 등)
                 // 통화 참여자 변경 이벤트 발생 시 세션 통화 정보 업데이트 (callId 변경 등)
                 // 원본 코드는 party changed 이벤트가 아닌 call.partychanged 이벤트를 처리하는 듯 합니다.
                 // e.callId -> e.newCallId로 변경하는 로직 유지
                 // 이 이벤트의 정확한 사용법은 SDK 문서 확인 필요
                 if (e.callId && e.connId && e.newCallId) {
                      this.session.chgCall(e.callId, e.connId, e.newCallId);
                      console.log(`Call Party Changed: ${e.callId}:${e.connId} -> ${e.newCallId}`);
                      // Party changed가 반드시 UI 상태 변경을 유발하는지는 SDK 문서 확인 필요.
                      // 일반적으로 Transfer/Conference 완료 후 통화 상태가 바뀔 수 있습니다.
                      // stateChanged = true;
                 }
                break;
            case Ipron.EVENT.TYPE.CALL?.UPDATEUSERDATA: // 통화 사용자 데이터 업데이트
                 // 통화 사용자 데이터 업데이트 이벤트 발생 시 데이터 조회
                 if (e.callId && this.session.tid) {
                     console.log("Update Userdata event received for callId:", e.callId);
                     this.getUserData(this.session.tid, e.callId); // 사용자 데이터 다시 가져오기
                 }
                 break;
            default:
                 // 처리되지 않은 기타 이벤트 로깅
                 console.log('Unhandled Ipron event:', event, e);
                 break;
        }

        // UI 상태 변경 플래그가 true이면 UI 업데이트 함수 호출
        if (stateChanged) {
            this.refreshCallStatus();
        }
    }

    /**
     * 사용자별 이벤트 모니터링을 시작합니다. (필요시 주석 해제 후 사용)
     * 이 함수는 Login 성공 후 호출되어야 합니다.
     */
    // StartUserEventMonitor() {
    //     if (!this.session.isLogin()) {
    //          console.warn("Cannot start event monitor: Agent not logged in.");
    //          return;
    //      }
    //      console.log(`Starting user event monitor for user: ${this.session.uid}`);
    //     // Ipron.notify.addUserSubscriptions 함수가 콜백 형식으로 이벤트를 받아 처리하는 방식 가정
    //      try {
    //          Ipron.notify.addUserSubscriptions(this.session.tid, this.session.uid, eventJson => {
    //              try {
    //                  const event = JSON.parse(eventJson);
    //                  if (event && event.data && event.data.event) {
    //                      this.EventHandler(event.data.event, event.data);
    //                      this.EmmitEvent(event);
    //                  } else {
    //                      console.warn("Received subscription event with unexpected structure:", eventJson);
    //                  }
    //              } catch (parseError) {
    //                  console.error("Failed to parse subscription event JSON:", parseError, eventJson);
    //              }
    //          });
    //           console.log("User event monitor started successfully.");
    //      } catch (error) {
    //           console.error("Failed to start user event monitor:", error);
    //      }
    // }

    /**
     * 사용자별 이벤트 모니터링을 중지합니다. (필요시 주석 해제 후 사용)
     * 이 함수는 Logout 또는 UnInit 시 호출되어야 합니다.
     */
    // StopUserEventMonitor() {
    //     if (this.session.uid) { // 사용자 ID가 있을 경우에만 중지 시도
    //         console.log(`Stopping user event monitor for user: ${this.session.uid}`);
    //         try {
    //             Ipron.notify.delUserSubscriptions(this.session.uid);
    //              console.log("User event monitor stopped.");
    //         } catch (error) {
    //             console.error("Failed to stop user event monitor:", error);
    //         }
    //     }
    // }

    /*******************
     * 콜 제어 SDK API Wrapper 함수 (async/await 패턴 유지)
     *******************/

    /**
     * Ipron SDK의 Answer API를 호출합니다.
     * @param {string} tId
     * @param {string} callId
     * @param {string} connId
     * @returns {Promise<object>} SDK 응답 객체
     */
    async Answer(tId, callId, connId) {
        try {
            console.log(`Calling Ipron.call.answer for callId: ${callId}`);
            const result = await Ipron.call.answer(tId, callId, connId);
            if (!result?.result) {
                console.warn('answer result: fail', result?.reason || "Unknown error");
            } else {
                console.log('answer result: success');
            }
             return result;
        } catch (error) {
            console.error("Error calling Ipron.call.answer:", error);
            throw error;
        }
    }

    /**
     * Ipron SDK의 Hold API를 호출합니다.
     * @param {string} tId
     * @param {string} callId
     * @param {string} connId
     * @returns {Promise<object>} SDK 응답 객체
     */
    async Hold(tId, callId, connId) {
        try {
            console.log(`Calling Ipron.call.hold for callId: ${callId}`);
            const result = await Ipron.call.hold(tId, callId, connId);
            if (!result?.result) {
                console.warn('hold result: fail', result?.reason || "Unknown error");
            } else {
                console.log('hold result: success');
            }
             return result;
        } catch (error) {
            console.error("Error calling Ipron.call.hold:", error);
            throw error;
        }
    }

    /**
     * Ipron SDK의 UnHold API를 호출합니다.
     * @param {string} tId
     * @param {string} callId
     * @param {string} connId
     * @returns {Promise<object>} SDK 응답 객체
     */
    async UnHold(tId, callId, connId) {
        try {
             console.log(`Calling Ipron.call.unhold for callId: ${callId}`);
            const result = await Ipron.call.unhold(tId, callId, connId);
            if (!result?.result) {
                console.warn('unhold result: fail', result?.reason || "Unknown error");
            } else {
                console.log('unhold result: success');
            }
             return result;
        } catch (error) {
            console.error("Error calling Ipron.call.unhold:", error);
            throw error;
        }
    }

    /**
     * Ipron SDK의 Release API를 호출합니다.
     * @param {string} tId
     * @param {string} callId
     * @param {string} connId
     * @returns {Promise<object>} SDK 응답 객체
     */
    async Release(tId, callId, connId) {
        try {
             console.log(`Calling Ipron.call.releaseCall for callId: ${callId}`);
            const result = await Ipron.call.releaseCall(tId, callId, connId);
            if (!result?.result) {
                console.warn('release result: fail', result?.reason || "Unknown error");
            } else {
                console.log('release result: success');
            }
             return result;
        } catch (error) {
            console.error("Error calling Ipron.call.releaseCall:", error);
            throw error;
        }
    }

    /**
     * Ipron SDK의 Single Step Transfer API를 호출합니다.
     * @param {string} tId
     * @param {string} callId
     * @param {string} connId
     * @param {string} dnis - 대상 번호
     * @returns {Promise<object>} SDK 응답 객체
     */
    async SSTransfer(tId, callId, connId, dnis) {
        const routeOption = { type: 0 }; // SDK 문서 확인 필요
        try {
            console.log(`Calling Ipron.call.singleStepTransfer for callId: ${callId} to ${dnis}`);
            const result = await Ipron.call.singleStepTransfer(tId, callId, connId, dnis, "", "", "", routeOption);
            if (!result?.result) {
                console.warn('sstransfer result: fail', result?.reason || "Unknown error");
            } else {
                console.log('sstransfer result: success');
            }
             return result;
        } catch (error) {
            console.error("Error calling Ipron.call.singleStepTransfer:", error);
            throw error;
        }
    }

    /**
     * Ipron SDK의 Mute Transfer (또는 Two Step Transfer) API를 호출합니다.
     * @param {string} tId
     * @param {string} holdCallId - 보류된 통화의 Call ID
     * @param {string} holdConnId - 보류된 통화의 Connection ID
     * @param {string} activeCallId - 활성 통화의 Call ID (전환 대상)
     * @returns {Promise<object>} SDK 응답 객체
     */
    async Transfer(tId, holdCallId, holdConnId, activeCallId) {
         // SDK 문서에 muteTransfer가 Transfer 함수인지는 확인 필요
         // 파라미터 순서 및 역할 확인 필요
        try {
            console.log(`Calling Ipron.call.muteTransfer from holdCallId: ${holdCallId} to activeCallId: ${activeCallId}`);
            const result = await Ipron.call.muteTransfer(tId, holdCallId, holdConnId, activeCallId);
            if (!result?.result) {
                console.warn('transfer result: fail', result?.reason || "Unknown error");
            } else {
                console.log('transfer result: success');
            }
             return result;
        } catch (error) {
            console.error("Error calling Ipron.call.muteTransfer:", error);
            throw error;
        }
    }


    /**
     * Ipron SDK의 Single Step Conference API를 호출합니다.
     * @param {string} tId
     * @param {string} callId
     * @param {string} connId
     * @param {string} dnis - 대상 번호
     * @param {string} partyType - 파티 타입 (예: "holdmoh", "party") - SDK 문서 확인 필요
     * @returns {Promise<object>} SDK 응답 객체
     */
    async SSConference(tId, callId, connId, dnis, partyType) {
        try {
             console.log(`Calling Ipron.call.singleStepConference for callId: ${callId} to ${dnis}`);
             const result = await Ipron.call.singleStepConference(tId, callId, connId, dnis, "", "", "", partyType);
             if (!result?.result) {
                 console.warn('ssconference result: fail', result?.reason || "Unknown error");
             } else {
                 console.log('ssconference result: success');
             }
              return result;
         } catch (error) {
             console.error("Error calling Ipron.call.singleStepConference:", error);
             throw error;
         }
    }

    /**
     * Ipron SDK의 Mute Conference API를 호출합니다.
     * @param {string} tId
     * @param {string} holdCallId - 보류된 통화의 Call ID
     * @param {string} holdConnId - 보류된 통화의 Connection ID
     * @param {string} activeCallId - 활성 통화의 Call ID (컨퍼런스에 참여시킬 통화)
     * @param {string} partyType - 파티 타입 (예: "party") - SDK 문서 확인 필요
     * @returns {Promise<object>} SDK 응답 객체
     */
    async Conference(tId, holdCallId, holdConnId, activeCallId, partyType) {
         // SDK 문서에 muteConference가 Conference 함수인지는 확인 필요
         // 파라미터 순서 및 역할 확인 필요
        try {
             console.log(`Calling Ipron.call.muteConference with holdCallId: ${holdCallId} and activeCallId: ${activeCallId}`);
             const result = await Ipron.call.muteConference(tId, holdCallId, holdConnId, activeCallId, partyType);
             if (!result?.result) {
                 console.warn('conference result: fail', result?.reason || "Unknown error");
             } else {
                 console.log('conference result: success');
             }
              return result;
         } catch (error) {
             console.error("Error calling Ipron.call.muteConference:", error);
             throw error;
         }
    }

    /**
     * Ipron SDK의 Make Call API를 호출합니다.
     * @param {string} tId - 테넌트 ID
     * @param {string} userId - 사용자 ID
     * @param {string} ani - 발신자 번호 (Agent Number Identification)
     * @param {string} dnis - 대상 번호 (Dialed Number Identification Service)
     * @param {string} userAni - 사용자 ANI
     * @returns {Promise<object | void>} SDK 응답 객체 또는 오류 발생 시 void
     */
    async Call(tId, userId, ani, dnis, userAni) {
        const routeOption = { type: 0 }; // SDK 문서 확인 필요
        const mediaType = Ipron.MEDIA_TYPE.VOICE;
        const uei = ""; // 예시 사용자 데이터
        const uui = "";       // 예시 캠페인 ID

        if (!tId || !userId || !ani || !dnis) {
             console.error("Required parameters for MakeCall are missing.");
             return;
        }

        try {
            console.log(`Calling Ipron.call.makeCallEx for user: ${userId} to ${dnis}`);
            const result = await Ipron.call.makeCallEx(tId, userId, ani, dnis, userAni, mediaType, uei, uui, routeOption);
            if (!result?.result) {
                console.warn('makeCall result: fail', result?.reason || "Unknown error");
            } else {
                console.log('makeCall result: success', result.data?.callId);
            }
             return result;
        } catch (error) {
            console.error("Error calling Ipron.call.makeCallEx:", error);
            // Axios 응답 구조에 따라 오류 처리
            if (error.response?.data) {
                 const errorResult = error.response.data;
                 console.error("SDK error response:", errorResult);
                 switch (error.response.status) {
                     case 404:
                         console.error("Call Failed: Destination not found (404).");
                         this.setCallStatus("Call Failed: Not Found");
                         break;
                     // 다른 HTTP 상태 코드에 따른 처리 추가
                     default:
                         console.error(`Call Failed: API returned status ${error.response.status} with code ${errorResult.code}.`);
                         this.setCallStatus(`Call Failed: ${error.response.status}`);
                         break;
                 }
            } else {
                 console.error("Call Failed: Network or unknown error.", error);
                 this.setCallStatus(`Call Failed: ${error.message || "Unknown Error"}`);
            }
            // 에러 발생 시 상위에서 catch 하지 않도록 여기서 처리 종료
        }
    }

    /**
     * 통화 세션 정보를 관리하는 헬퍼 클래스입니다.
     * INESoftPhone 클래스 내부에서만 사용됩니다.
     */
    static SessionManager = class {
        constructor() {
            this.reset(); // 초기 상태 설정
        }

        reset() {
            this.tid = "";
            this.uid = "";
            this.uname = "";
            this.email = "";
            this.dn = "";
            this.refreshToken = "";
            this.presenceStatus = ""; // 에이전트 상태 (Ipron.AGENT_STATE 값)
            this.call = []; // 현재 통화 목록 [{callid, connid, status}, ...]
            this.activeCallIndex = -1; // 활성 통화의 배열 인덱스
        }

        /**
         * 사용자 로그인 상태인지 확인합니다.
         * @returns {boolean} 로그인 상태 여부
         */
        isLogin() {
            return this.uid !== "";
        }

        /**
         * 특정 callId와 connId를 가진 통화를 찾습니다.
         * @param {string} callId
         * @param {string} connId
         * @returns {object | undefined} 해당 통화 객체 또는 찾지 못하면 undefined
         */
        findCall(callId, connId) {
            return this.call.find(item => item.callid === callId && item.connid === connId);
        }

        /**
         * 새로운 통화를 세션에 추가합니다.
         * @param {string} callId
         * @param {string} connId
         */
        addCall(callId, connId) {
             // 이미 존재하는 통화인지 확인 (이벤트 중복 방지)
             if (this.findCall(callId, connId)) {
                 console.warn(`Call ${callId}:${connId} already exists in session.`);
                 return;
             }
            const newCall = {
                callid: callId,
                connid: connId,
                status: "null", // 초기 상태
            };
            this.call.push(newCall);
            this.activeCallIndex = this.call.length - 1; // 마지막 추가된 통화를 활성 통화로 설정
            console.log(`Call added: ${callId}:${connId}. Total calls: ${this.call.length}`);
        }

        /**
         * 특정 통화의 상태를 업데이트합니다.
         * @param {string} callId
         * @param {string} connId
         * @param {string} status - 새로운 상태 (SDK 통화 상태 문자열)
         */
        setCallStatus(callId, connId, status) {
            const call = this.findCall(callId, connId);
            if (call) {
                call.status = status;
                console.log(`Call ${callId}:${connId} status updated to: ${status}`);
            } else {
                 console.warn(`Call ${callId}:${connId} not found to update status.`);
            }
        }

        /**
         * 특정 통화를 세션에서 제거합니다.
         * @param {string} callId
         * @param {string} connId
         */
        delCall(callId, connId) {
            const initialLength = this.call.length;
            this.call = this.call.filter(item => !(item.callid === callId && item.connid === connId));

            if (this.call.length < initialLength) {
                console.log(`Call deleted: ${callId}:${connId}. Remaining calls: ${this.call.length}`);
                // 통화 목록 변경 후 활성 통화 인덱스 재계산 (단순화)
                 if (this.activeCallIndex >= this.call.length) {
                      this.activeCallIndex = this.call.length - 1; // 마지막 통화로 설정 또는 -1
                 }
            } else {
                 console.warn(`Call ${callId}:${connId} not found to delete.`);
            }
        }

        /**
         * 특정 통화의 callId를 변경합니다 (예: Transfer 후 새로운 콜 생성 시).
         * @param {string} callId - 이전 callId
         * @param {string} connId
         * @param {string} newCallId - 새로운 callId
         */
        chgCall(callId, connId, newCallId) {
            const call = this.findCall(callId, connId);
            if (call) {
                call.callid = newCallId;
                console.log(`Call ${callId}:${connId} callId changed to: ${newCallId}`);
            } else {
                 console.warn(`Call ${callId}:${connId} not found to change callId.`);
            }
        }

        /**
         * 현재 활성 통화의 인덱스를 반환합니다.
         * @returns {number} 활성 통화의 배열 인덱스 또는 -1
         */
        getActiveCallIndex() {
             // 현재 로직은 단순히 마지막 추가된 통화를 활성으로 간주합니다.
             // 실제 CTI 시나리오에서는 활성 통화를 결정하는 로직이 더 복잡할 수 있습니다.
             return this.activeCallIndex;
        }

        /**
         * 현재 활성 통화 객체를 반환합니다.
         * @returns {object | null} 활성 통화 객체 또는 통화가 없으면 null
         */
        getActiveCall() {
             const index = this.getActiveCallIndex();
             return index > -1 && this.call.length > index ? this.call[index] : null;
        }

        /**
         * 현재 활성 통화의 Call ID를 반환합니다.
         * @returns {string} Call ID 또는 통화가 없으면 빈 문자열
         */
        getActiveCallId() {
            const activeCall = this.getActiveCall();
            return activeCall ? activeCall.callid : "";
        }

        /**
         * 현재 활성 통화의 Connection ID를 반환합니다.
         * @returns {string} Connection ID 또는 통화가 없으면 빈 문자열
         */
        getActiveConnId() {
            const activeCall = this.getActiveCall();
            return activeCall ? activeCall.connid : "";
        }

        /**
         * 현재 활성 통화의 상태를 반환합니다.
         * @returns {string} 통화 상태 문자열 또는 통화가 없으면 "null"
         */
        getActiveCallStatus() {
            const activeCall = this.getActiveCall();
            return activeCall ? activeCall.status : "null";
        }

         /**
         * 보류된 통화 객체를 반환합니다. (원래 코드의 activeCall() == 1 일 때 index 0 통화를 보류로 간주하는 로직 따름)
         * 이 로직은 매우 단순하며, 실제 시나리오에 따라 수정이 필요할 수 있습니다.
         * @returns {object | null} 보류 통화 객체 또는 해당 통화가 없으면 null
         */
        getHoldCall() {
             // 원래 코드 로직: 활성 통화 인덱스가 1일 때만 인덱스 0의 통화를 보류로 간주
             // 이는 통화가 2개이고 두 번째 통화가 활성일 때 첫 번째 통화가 보류된다는 가정을 기반합니다.
            return this.activeCallIndex === 1 && this.call.length > 0 ? this.call[0] : null;
        }

        /**
         * 보류된 통화의 Call ID를 반환합니다.
         * @returns {string} Call ID 또는 해당 통화가 없으면 빈 문자열
         */
        getHoldCallId() {
            const holdCall = this.getHoldCall();
            return holdCall ? holdCall.callid : "";
        }

         /**
         * 보류된 통화의 Connection ID를 반환합니다.
         * @returns {string} Connection ID 또는 해당 통화가 없으면 빈 문자열
         */
        getHoldConnId() {
            const holdCall = this.getHoldCall();
            return holdCall ? holdCall.connid : "";
        }

        /**
         * 특정 인덱스의 통화 Call ID를 반환합니다. (원본 코드 메서드 유지)
         * @param {number} idx - 통화의 배열 인덱스
         * @returns {string} Call ID 또는 해당 인덱스에 통화가 없으면 빈 문자열
         */
        getCallId(idx) {
             return idx > -1 && this.call.length > idx ? this.call[idx].callid : "";
        }

        /**
         * 특정 인덱스의 통화 Connection ID를 반환합니다. (원본 코드 메서드 유지)
         * @param {number} idx - 통화의 배열 인덱스
         * @returns {string} Connection ID 또는 해당 인덱스에 통화가 없으면 빈 문자열
         */
        getConnId(idx) {
            return idx > -1 && this.call.length > idx ? this.call[idx].connid : "";
        }
    };

}

// Ipron 객체 및 하위 속성들이 전역 또는 모듈 스코프에 정의되어 있다고 가정합니다.
// 예: const Ipron = { ... };
// 실제 환경에 맞게 Ipron 객체 정의 또는 import 필요
// const Ipron = {
//     init: (baseUrl, timeout, isDebug) => { console.log(`Ipron.init: ${baseUrl}`); },
//     oauth2: {
//         login: async (user, pass, tenant, media, status, cause, dn, cb) => {
//             console.log(`Ipron.oauth2.login: ${user}@${tenant}`);
//             // 더미 응답
//             await new Promise(resolve => setTimeout(resolve, 100)); // 비동기 흉내
//             if (user === 'test' && pass === 'pass') {
//                 const token = btoa(JSON.stringify({ _id: 'user123', name: 'Test User', email: 'test@example.com', tntId: 'tenant456', tntName: 'Test Tenant', tntAlias: 'tt' }));
//                 // 더미 이벤트 발생 시뮬레이션 (실제 SDK는 콜백을 통해 이벤트를 전달)
//                 setTimeout(() => {
//                      cb({ data: { event: 'event.userassignchanged', oldState: 'unknown', newState: Ipron.AGENT_STATE.READY } });
//                      cb({ data: { event: Ipron.EVENT.TYPE.USER.USERSTATECHANGED, oldState: 'unknown', newState: Ipron.AGENT_STATE.READY, epId: 'user123' } });
//                 }, 500);
//                 return { result: true, data: { accessToken: `.${token}.`, refreshToken: 'refresh123' } };
//             } else {
//                 return { result: false, reason: 'Invalid credentials' };
//             }
//         },
//         logout: async (tId, userId, media, cause) => {
//             console.log(`Ipron.oauth2.logout: ${userId}@${tId}`);
//             await new Promise(resolve => setTimeout(resolve, 50));
//             return { result: true };
//         },
//     },
//     info: {
//          getAgentInfo: async (tId, userId) => {
//              console.log(`Ipron.info.getAgentInfo: ${userId}@${tId}`);
//               await new Promise(resolve => setTimeout(resolve, 50));
//               return { result: true, data: { name: 'Test Agent', _id: userId, extension: '1001' } };
//          }
//     },
//     presence: {
//          getUserState: async (tId, userId, media) => {
//              console.log(`Ipron.presence.getUserState: ${userId}@${tId}`);
//              await new Promise(resolve => setTimeout(resolve, 50));
//              // 더미 상태 반환
//              return { result: true, stateset: [Ipron.AGENT_STATE.READY], causeset: [""] };
//          },
//          setUserState: async (tId, userId, media, status, cause) => {
//              console.log(`Ipron.presence.setUserState: ${userId}@${tId} to ${status}`);
//              await new Promise(resolve => setTimeout(resolve, 50));
//               return { result: true };
//          }
//     },
//     call: {
//         makeCallEx: async (tId, userId, ani, dnis, userAni, media, userData, campaignId, routeOption) => {
//             console.log(`Ipron.call.makeCallEx: ${userId} calling ${dnis}`);
//             await new Promise(resolve => setTimeout(resolve, 200));
//              // 더미 응답
//              const dummyCallId = `call-${Date.now()}`;
//              const dummyConnId = `conn-${Date.now()}`;
//              // 통화 상태 변경 이벤트 시뮬레이션
//              setTimeout(() => {
//                  // ALERTING 이벤트
//                  const alertEvent = { data: { event: Ipron.EVENT.TYPE.CALL.ALERTING, callId: dummyCallId, connId: dummyConnId, connNewState: 'alerting', epId: userId, eventEpId: userId } };
//                  // 여기서 INESoftPhone 인스턴스의 eventCallback 직접 호출 필요 (실제 SDK는 다르게 동작)
//                   // 예: window.dispatchEvent(new CustomEvent('IpronEvent', { detail: alertEvent }));
//              }, 300);
//              setTimeout(() => {
//                  // CONNECTED 이벤트
//                   const connectedEvent = { data: { event: Ipron.EVENT.TYPE.CALL.CONNECTED, callId: dummyCallId, connId: dummyConnId, connNewState: 'connected', epId: userId, eventEpId: userId, partyCnt: 2 } };
//                    // 예: window.dispatchEvent(new CustomEvent('IpronEvent', { detail: connectedEvent }));
//              }, 1000);

//             return { result: true, data: { callId: dummyCallId, connId: dummyConnId } };
//         },
//          answer: async (tId, callId, connId) => { console.log(`Ipron.call.answer: ${callId}`); await new Promise(resolve => setTimeout(resolve, 50)); return { result: true }; },
//          hold: async (tId, callId, connId) => { console.log(`Ipron.call.hold: ${callId}`); await new Promise(resolve => setTimeout(resolve, 50)); return { result: true }; },
//          unhold: async (tId, callId, connId) => { console.log(`Ipron.call.unhold: ${callId}`); await new Promise(resolve => setTimeout(resolve, 50)); return { result: true }; },
//          releaseCall: async (tId, callId, connId) => { console.log(`Ipron.call.releaseCall: ${callId}`); await new Promise(resolve => setTimeout(resolve, 50));
//              // 끊김 이벤트 시뮬레이션
//              setTimeout(() => {
//                  const disconnectEvent = { data: { event: Ipron.EVENT.TYPE.CALL.DISCONNECTED, callId: callId, connId: connId, connNewState: 'disconnected', epId: 'user123', eventEpId: 'user123' } }; // Assume user123 was involved
//                   // 예: window.dispatchEvent(new CustomEvent('IpronEvent', { detail: disconnectEvent }));
//              }, 100);
//              return { result: true };
//          },
//         singleStepTransfer: async (tId, callId, connId, dnis, param4, param5, param6, routeOption) => { console.log(`Ipron.call.singleStepTransfer: ${callId} to ${dnis}`); await new Promise(resolve => setTimeout(resolve, 150)); return { result: true }; },
//         muteTransfer: async (tId, holdCallId, holdConnId, activeCallId) => { console.log(`Ipron.call.muteTransfer: ${holdCallId} and ${activeCallId}`); await new Promise(resolve => setTimeout(resolve, 150)); return { result: true }; },
//         singleStepConference: async (tId, callId, connId, dnis, param5, param6, param7, partyType) => { console.log(`Ipron.call.singleStepConference: ${callId} to ${dnis}`); await new Promise(resolve => setTimeout(resolve, 150)); return { result: true }; },
//         muteConference: async (tId, holdCallId, holdConnId, activeCallId, partyType) => { console.log(`Ipron.call.muteConference: ${holdCallId} and ${activeCallId}`); await new Promise(resolve => setTimeout(resolve, 150)); return { result: true }; },
//         getUserdata: async (tId, callId) => { console.log(`Ipron.call.getUserdata: ${callId}`); await new Promise(resolve => setTimeout(resolve, 50)); return { result: true, data: { key1: 'value1' } }; },
//     },
//      notify: {
//          addUserSubscriptions: (tId, userId, cb) => { console.log(`Ipron.notify.addUserSubscriptions for ${userId}`); /* 실제 구독 로직 */ },
//          delUserSubscriptions: (userId) => { console.log(`Ipron.notify.delUserSubscriptions for ${userId}`); /* 실제 구독 해제 로직 */ }
//      },
//      util: {
//          decodeJWT: (token) => {
//              try {
//                  const payload = token.split('.')[1];
//                  return JSON.parse(atob(payload));
//              } catch (e) {
//                  console.error("Failed to decode JWT:", e);
//                  return {};
//              }
//          }
//      },
//      MEDIA_TYPE: { VOICE: 'voice' },
//      AGENT_STATE: { LOGOUT: 'logout', NOTREADY: 'notready', READY: 'ready', INREADY: 'inready', OUTREADY: 'outready', AFTERWORK: 'afterwork' },
//      AGENT_STATE_CAUSE: { IDLE: 'idle' },
//      EVENT: {
//          TYPE: {
//              PHONE: { BUSY: 'phone.busy' },
//              USER: { USERSTATECHANGED: 'user.userstatechanged' },
//              CALL: {
//                  ALERTING: 'call.alerting',
//                  CONNECTED: 'call.connected',
//                  HOLD: 'call.hold',
//                  UNHOLD: 'call.unhold',
//                  DISCONNECTED: 'call.disconnected',
//                  PARTYCHANGED: 'call.partychanged',
//                  UPDATEUSERDATA: 'call.updateuserdata'
//              }
//          }
//      }
//  };

//  // Ipron SDK가 전역에 노출되지 않는다면, 이 INESoftPhone 클래스를 Ipron 객체를 주입받도록 수정해야 합니다.
//  // 예: constructor(el, config, ipronSdk) { this.ipron = ipronSdk; ... }