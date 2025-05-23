/*
 * Copyright (c) 2025 BridgeTech Inc.
 * Licensed under the MIT License.
 * See LICENSE file in the project root for full license information.
 */

'use strict';

// 비동기 스크립트 로더 함수
async function LoadScript(scripts) {
	for (const src of scripts) {
		await new Promise((resolve, reject) => {
			const script = document.createElement('script');
			script.src = src;
			script.onload = resolve;
			script.onerror = reject;
			document.head.appendChild(script);
		});
	}
}

function LoadPhoneModule(modules, callback) {
	(async () => {
		await LoadScript(modules);
		if (callback) callback();
	})();
}

const EventName = {
	EventNetConnect:          "net-connected",
	EventNetDisconnect:       "net-disconnected",

	EventRegistered:          "registered",
	EventUnRegistered:        "unregistered",
	EventRegisterFail:        "register-fail",

	EventCallCreated:         "call-created",

	EventInboundReceived:     "inbound-received",
	EventInboundAccepted:     "inbound-accepted",
	EventInboundConnected:    "inbound-connected",
	EventInboundFailed:       "inbound-failed",
	EventInboundEnd:          "inbound-end",

	EventOutboundProgress:    "outbound-progress",
	EventOutboundAccepted:    "outbound-accepted",
	EventOutboundConnected:   "outbound-connected",
	EventOutboundFailed:      "outbound-failed",
	EventOutboundEnd:         "outbound-end",

	EventConsultElevated:     "consult-elevated",

	EventTransferReqSuccess:  "transfer-req-success",
	EventTransferReqFailed:   "transfer-req-failed",
	EventTransferProgress:    "transfer-progress",
	EventTransferAccepted:    "transfer-accpeted",
	EventTransferFailed:      "transfer-failed",

	EventTransfer:            "transfer",
	EventNotify:              "notify",

	EventReinviteReceived:    "reinvite-received",
	EventReinviteAccepted:    "reinvite-accepted",
	EventReinviteFailed:      "reinvite-failed",
	EventReinviteAckReceived: "reinvite-ack-received",

	EventHold:                "hold",
	EventUnHold:              "unhold",
};

class EventHub
{
	_triggers = {};

	// 이벤트 등록
	on(event, callback)
	{
		if (callback == null) return;

		if (!this._triggers[event]) this._triggers[event] = [];
		this._triggers[event].push(callback);
	}

	// 이벤트 발생
	fireTrigger(event, ...args)
	{
		if (this._triggers[event])
		{
			for (let fn of this._triggers[event])
				fn.apply(this, args);
		}		
	}
}

class INECallPhone extends EventHub
{
	static #_jssipLoaded = false;
	static userAgentName = 'ipron_webrtc.1.0.0';
	get Event() {
		return EventName;
	}

	#_config = {
		dn:     '',
		md5Id:  '',
		md5Pwd: '',
		sipServer: '',
		sipDomain: '',
		regExpire: 180,
		sessTimer: 90,
		iceServer: [],
		userAgent: "IPRON-NE SoftPhone 1.0",
		audioInElementID: '',
		audioOutElementID: '',
	};

	isMobile = (window.AndroidInterface || window.webkit);
	isRinging = false;
	delay = 10;
	L1State = false;
	readyCompleteCb = null;

	#ModuleLoad() {
		if (!INECallPhone.#_jssipLoaded) {
			INECallPhone.#_jssipLoaded = true;

			LoadPhoneModule([
				"js/webrtc/jssip-3.7.0.js",
				"js/webrtc/log.js",
				"js/webrtc/device.js",
				"js/webrtc/sa.js",
			], function() {
				this.delay = 10
				this.ReadyInit();
			}.bind(this));
		} else {
			this.delay = 10
			this.ReadyInit();
		}
	}

	constructor(config, complateFn) {
		super()

		if (!config) return;

		Object.assign(this.#_config, config);
		this.readyCompleteCb = complateFn;
		this.#ModuleLoad()
	}

	Init(config, complateFn) {
		if (!config) return;

		Object.assign(this.#_config, config);
		this.readyCompleteCb = complateFn;
		this.#ModuleLoad()
	}

	GetDN() {
		return this.#_config.dn;
	}

	ReadyInit() {
		setTimeout(() => {
			if (device_found) {
				this.#onInit();
			} else {
				this.delay *= 2;
				if (this.delay > 1000) this.delay = 1000;
				this.ReadyInit(); // 정상 작동
			}
		}, this.delay);
	}

	#onInit() {
		if (this.isMobile) {
			this.SetAudioHead();
		}

		let audioSrc = this.GetAudioSource();
		// this class 에서 정의로 대체
		/*
		let CallBack = {
            TransportConnected:     this.TransportConnected.bind(this),
            TransportDisconnected:  this.TransportDisconnected.bind(this),
            Registered:             this.Registered.bind(this),
            Unregistered:           this.Unregistered.bind(this),
            RegisterFailed:         this.RegisterFailed.bind(this),
            CallCreated:            this.CallCreated.bind(this),
            InboundReceived:        this.InboundReceived.bind(this),
            InboundAccepted:        this.InboundAccepted.bind(this),
            InboundConnected:       this.InboundConnected.bind(this),
            InboundFailed:          this.InboundFailed.bind(this),
            InboundEnded:           this.InboundEnded.bind(this),
            OutboundProgress:       this.OutboundProgress.bind(this),
            OutboundAccepted:       this.OutboundAccepted.bind(this),
            OutboundConnected:      this.OutboundConnected.bind(this),
            OutboundFailed:         this.OutboundFailed.bind(this),
            OutboundEnded:          this.OutboundEnded.bind(this),
            ConsultSessionElevated: this.ConsultSessionElevated.bind(this),
            TransferRqSucceeded:    this.TransferRqSucceeded.bind(this),
            TransferRqFailed:       this.TransferRqFailed.bind(this),
            TransferProgress:       this.TransferProgress.bind(this),
            TransferAccepted:       this.TransferAccepted.bind(this),
            TransferFailed:         this.TransferFailed.bind(this),
            ReferReceived:          this.ReferReceived.bind(this),
            NotifyReceived:         this.NotifyReceived.bind(this),
            ReinviteReceived:       this.ReinviteReceived.bind(this),
            ReinviteAckReceived:    this.ReinviteAckReceived.bind(this),
            PlayStarted:            this.PlayStarted.bind(this),
            PlayStopped:            this.PlayStopped.bind(this),
		}
		*/

		// https://127.0.0.1:8443/call.html
		// https://100.100.106.153:5063
        var arg = {
            appControl:     this.isMobile?1:0,
            serverAddress:  this.#_config.sipServer, // SIP Server IP:Port
            serverDomain:   this.#_config.sipDomain, // SIP 메시지 헤더구성용 Domain
            myNumber:       this.#_config.dn,        // 전화번호
            myId:           this.#_config.md5Id,     // MD5 ID
            myPasswd:       this.#_config.md5Pwd,    // MD5 PASSWORD
            regExpire:      this.#_config.regExpire, // REGISTER 주기
            iceTimeout:     1000,                    // ICE candidate 수집용 Timeout
            speakerVolume:  1.0,                     // Speaker Volume
            sideToneVolume: 0.0,                     // 마이크 to Speaker Echo Volume
            inAudio:        audioSrc.inaudio,        // 오디오 입력장치 DeviceID
            outAudio:       audioSrc.outaudio,       // 오디오 출력장치 DeviceID
            inAudioText:    audioSrc.intext,         // 오디오 입력장치 이름
            outAudioText:   audioSrc.outtext,        // 오디오 출력장치 이름
            callBack:       this,           // 이벤트에 대한 콜백 함수 구조체
            logwrite:       this.LogOut,             // 로그 함수
            user_agent:     this.#_config.userAgent, // SIP 메시지내 User-Agent 지정 문자열
        };

        // 라이브러리 초기화
        websip.sockInit(arg);

        this.readyCompleteCb();
/*
        // WebSocket 연결
        websip.sockConnect();
        // SIP Register 시작 (WebSocket 미연결시 자동연결)
        websip.sipRegister();
*/
	}

	LogOut(msg) {
	}

	UnInit() {
		if (this.isMobile && this.isRinging) {
			websip.NotifyMobile({event: "stop_ring"});
		}

		websip.sockClose();
		websip.sockDestroy();
	}

    changeAudioSource(){
        var so = document.getElementById(this.#_config.audioInElementID);
        var inaudio = so.options[so.selectedIndex].value;
        var intext = so.options[so.selectedIndex].text;

        websip.changeAudioInputDevice(inaudio, intext);
    }

    changeAudioOutput(){
        var so = document.getElementById(this.#_config.audioOutElementID);
        var outaudio = so.options[so.selectedIndex].value;
        var outtext = so.options[so.selectedIndex].text;

        websip.changeAudioOutputDevice(outaudio, outtext);
    }

    // Audio / Speaker 목록중 첫번째 선택
    SetAudioHead() {
        var i, index, so;

        so = document.getElementById(this.#_config.audioInElementID);
        for (i = 0; i < so.options.length; i++) {
            index = so.options[i].text.toLowerCase().indexOf("head");
            if (index >= 0) {
                so.selectedIndex = i;
                break;
            }
        }
        so = document.getElementById(this.#_config.audioOutElementID);
        for (i = 0; i < so.options.length; i++) {
            index = so.options[i].text.toLowerCase().indexOf("head");
            if (index >= 0) {
                so.selectedIndex = i;
                break;
            }
        }

        return
    }

    // 현재 선택된 Audio /Speaker 정보 조회
    GetAudioSource() {
        var so;
        var ret = {
        	inaudio:  "",
        	intext:   "",
        	outaudio: "",
        	outtext:  "",
        };

        so = document.getElementById(this.#_config.audioInElementID);
        if (so.selectedIndex >= 0) {
            ret.inaudio = so.options[so.selectedIndex].value;
            ret.intext = so.options[so.selectedIndex].text;
        }
        so = document.getElementById(this.#_config.audioOutElementID);
        if(so.selectedIndex>=0){
            ret.outaudio = so.options[so.selectedIndex].value;
            ret.outtext = so.options[so.selectedIndex].text;
        }

        return ret;
    }

    IsLocalHold() {
    	return websip.getCurSession()?._localHold
    }

    IsRemoteHold() {
    	return websip.getCurSession()?._remoteHold
    }

	/******************
	 * 각종 콜백 이벤트 처리
	 ******************/

    // WebSocket 연결시 콜백
	TransportConnected = (data) => {
		var url = data.socket.url;

		this.fireTrigger(this.Event.EventNetConnect, data);
	}

	// WebSocket 연결 실패 또는 끊어진 경우 콜백
	TransportDisconnected = (data) => {
		var reason = data.reason;
		var url = data.socket.url;

		this.fireTrigger(this.Event.EventNetDisconnect, data);
	}

	// REGISTER 성공시 콜백
	Registered = (data) => {
		this.fireTrigger(this.Event.EventRegistered, data);
	}

	// REGISTER 해제된 경우 콜백
	Unregistered = (data) => {
		var cause = data.cause;

		this.fireTrigger(this.Event.EventUnRegistered, data);
	}

	// REGISTER 실패시 콜백
	RegisterFailed = (data) => {
		var cause = data.cause;

		this.fireTrigger(this.Event.EventRegisterFail, data);
	}

	// 인바운드/아웃바운드 콜 생성시 콜백
	// - outbound : sipCall() or sipConsultCall() 호출시 콜백
	// - outbound : REFER 수신시 자동 INVITE 발생
	// - inbound  : INVITE 수신
	CallCreated = (data) => {
		var nsession = data.session;
		var isConsult = nsession._data.isConsult;
		var replace = (nsession._data.replace)? "replace" : "";
		var consult = isConsult? "consult" : ""
		var call_id = nsession._request.getHeader("Call-ID");

		console.log(`[${nsession.direction + consult + replace}] Call-ID:${call_id} Remote:${nsession.remote_identity.uri} Local:${nsession.local_identity.uri}`)

		this.fireTrigger(this.Event.EventCallCreated, data);
	}

	// 인바운드 INVITE 수신 이벤트
	InboundReceived = (session, data) => {
		var isConsult = session._data.isConsult;
		var uuid = session._request.getHeader("IPRON-Info");
		var alert = session._request.getHeader("Alert-Info");

		switch (true) {
		case (alert === "auto-answer"):
			this.AnswerCall(isConsult);
			if (isConsult) this.HoldCall();
			break;
		case session._data.replace:
			this.AnswerCall(isConsult);
			break;
		case (this.isMobile && !this.isRinging):
			this.isRinging = true;
			websip.NotifyMobile({event: "start_ring"});
			break;
		}

		this.fireTrigger(this.Event.EventInboundReceived, session, data);
	}

	// 인바운드 1xx 전송후 콜백 (sipAccept() 호출시 콜백됨)
	InboundAccepted = (session, data) => {
		var isConsult = session._data.isConsult;

		this.fireTrigger(this.Event.EventInboundAccepted, session, data);
	}

	// 인바운드 200 OK 전송 후 ACK 수신시 콜백
	InboundConnected = (session, data) => {
		var isConsult = session._data.isConsult;

		if (!isConsult) {
			this.L1State = true;
		}
		this.fireTrigger(this.Event.EventInboundConnected, session, data);
	}

	// 인바운드 실패시 콜백 (sipReject() or sipDis() 호출시 콜백됨)
	InboundFailed = (session, data) => {
		var isConsult = session._data.isConsult;

		if (this.isMoble && this.isRinging) {
			this.isRinging = false;
			websip.NotifyMobile({event: "stop_ring"});
		}

		console.log(`${isConsult?"consult":"inbound"}call failed, cause=${data.cause}`)

		this.fireTrigger(this.Event.EventInboundFailed, session, data);
	}

	// 인바운드 콜 종료시 콜백
	InboundEnded = (session, data) => {
		var isConsult = session._data.isConsult;
		if (!isConsult) {
			this.L1State = false;
		}

		this.fireTrigger(this.Event.EventInboundEnd, session, data);
	}

	// 아웃바운드 INVITE 호출후 1xx 수신 이벤트
	OutboundProgress = (session, data) => {
		var isConsult = session._data.isConsult;

		this.fireTrigger(this.Event.EventOutboundProgress, session, data);
	}

	// 아웃바운드 INVITE 호출후 200 OK 수신시 콜백
	OutboundAccepted = (session, data) => {
		var isConsult = session._data.isConsult;
		var uuid = data.response.getHeader("IPRON-Info");

		this.fireTrigger(this.Event.EventOutboundAccepted, session, data);
	}

	// 아웃바운드 200 OK 수신 및 ACK 전송 후 콜백
	OutboundConnected = (session, data) => {
		var isConsult = session._data.isConsult;
		if (!isConsult) {
			this.L1State = true;
		}

		this.fireTrigger(this.Event.EventOutboundConnected, session, data);
	}

	// 아웃바운드 발신 실패 콜백
	OutboundFailed = (session, data) => {
		var isConsult = session._data.isConsult;
		var cause = data.cause

		this.fireTrigger(this.Event.EventOutboundFailed, session, data);
	}

	// 아웃바운드 콜이 종료되면 호출된다.
	// data.originator : 종료주체 정보 ('local'|'remote')
	OutboundEnded = (session, data) => {
		var isConsult = session._data.isConsult;
		if (!isConsult) {
			this.L1State = false;
		}

		this.fireTrigger(this.Event.EventOutboundEnd, session, data);
	}

	// 1차 콜과 2차 콜이 공존하는 상황에서, 1차 콜이 끊어지면 2차 콜이 1차 콜의 지위를 물려 받는다.
	ConsultSessionElevated = (direction) => {
		this.L1State = true;
		this.fireTrigger(this.Event.EventConsultElevated, direction);
	}

	// REFER 요청에 대한 성공 콜백
	TransferRqSucceeded = (subs, data) => {
		this.fireTrigger(this.Event.EventTransferReqSuccess, subs, data);
	}

	// REFER 요청에 대한 실패 콜백
	TransferRqFailed = (subs, data) => {
		this.fireTrigger(this.Event.EventTransferReqFailed, subs, data);
	}

	// REFER 요청에 대한 진행(180) NOTIFY 수신시 콜백
	TransferProgress = (subs, data) => {
		this.fireTrigger(this.Event.EventTransferProgress, subs, data);
	}

	// REFER 요청에 대한 성공(200) NOTIFY 수신시 콜백
	TransferAccepted = (subs, data) => {
		this.L1State = false;
		this.fireTrigger(this.Event.EventTransferAccepted, subs, data);
	}

	// REFER 요청에 대한 실패 NOTIFY 수신시 콜백
	TransferFailed = (subs, data) => {
		this.fireTrigger(this.Event.EventTransferFailed, subs, data);
	}

	// REFER 메시지 수신 콜백
	ReferReceived = (session, data) => {
		var referto = request.getHeader("Refer-To");

		if (referto) {
			console.log("  Refer-To: " + referto);
		}

		this.fireTrigger(this.Event.EventTransfer, session, data);
	}

	// NOTIFY 메시지 수신 콜백
	NotifyReceived = (session, data) => {
        var isConsult = session._data.isConsult;
        var event = data.request.event.event;
        var direction = (session.direction === "incoming")? "in" : "out";
        var type = isConsult? "consult" : "bound";

        switch (event) {
        case "hold":
        	if (isConsult) data.callback = websip.sipConsultHold;
        	else data.callback = websip.sipHold;
        	break;
        case "talk":
        	if (session._status === session.C.STATUS_WAITING_FOR_ANSWER) {
        		if (isConsult) data.callback = this.AnswerCallConsult;
        		else data.callback = this.AnswerCall;
        	} else {
        		if (isConsult) data.callback = websip.sipConsultUnhold;
        		else data.callback = websip.sipUnhold;
        	}
        	break;
        default:
        	data.reject();
        	break;
        }

		this.fireTrigger(this.Event.EventNotify, session, data);
	}

	ReinviteReceived = (session, data) => {
		var isConsult = session._data.isConsult;
		var direction = (session.direction === "incoming")? "in" : "out";
		var type = isConsult? "consult" : "bound";

		this.fireTrigger(this.Event.EventReinviteReceived, session, data);
	}

	ReinviteAccepted = (session, data) => {
		var isConsult = session._data.isConsult;
		var direction = (session.direction === "incoming")? "in" : "out";
		var type = isConsult? "consult" : "bound";

		this.fireTrigger(this.Event.EventReinviteAccepted, session, data);

		console.log("local-hold:" + this.IsLocalHold() + ", remote-hold:"+ this.IsRemoteHold())

		if (this.IsLocalHold())
			this.fireTrigger(this.Event.EventHold, session, data);
		else
			this.fireTrigger(this.Event.EventUnHold, session, data);
	}

	ReinviteFailed = (session, data) => {
		var isConsult = session._data.isConsult;
		var direction = (session.direction === "incoming")? "in" : "out";
		var type = isConsult? "consult" : "bound";

		this.fireTrigger(this.Event.EventReinviteFailed, session, data);
	}

	ReinviteAckReceived = (session, data) => {
		var isConsult = session._data.isConsult;
		var direction = (session.direction === "incoming")? "in" : "out";
		var type = isConsult? "consult" : "bound";

		this.fireTrigger(this.Event.EventReinviteAckReceived, session, data);

		console.log("local-hold:" + this.IsLocalHold() + ", remote-hold:"+ this.IsRemoteHold())

		if (this.IsLocalHold())
			this.fireTrigger(this.Event.EventHold, session, data);
		else
			this.fireTrigger(this.Event.EventUnHold, session, data);
	}

	PlayStarted = () => {
	}

	PlayStopped = () => {
	}

	/******************
	 * 각종 콜 제어 처리
	 ******************/

	/*
	SystemConnect() {
		websip.SystemCallConnected();
	}

	SystemDisconnect() {
		websip.SystemEndCallonnected();
	}

	// 아웃바운드용 : 연결후 전화걸기, 통화종료시 연결자동종료
	Connect2Call() {
		websip.Connect2Call();
	}

	// 인바운드용 : 연결후 REGISTER 하기, 통화 수신 연결후 종료시 자동종료
	Connect2Register() {
		websip.Connect2Register();
	}
	*/

	// SIP 전화 받기
	AnswerCall = (isConsult) => {
		if (this.isMobile && this.isRinging) {
			this.isRinging = false;
			websip.NotifyMobile({event: "stop_ring"});
		}

		let sessTimer = this.#_config.sessTimer;
		let turnInfo = this.#_config.iceServer;

		websip.sipAccept(sessTimer, turnInfo, undefined, isConsult);
	}

	// SIP 협의 전화 받기
	AnswerCallConsult = () => {
		AnswerCall(true);
	}

	// SIP 전화 거부하기
	CallReject = () => {
		if (this.isMobile && this.isRinging) {
			this.isRinging = false;
			websip.NotifyMobile({event: "stop_ring"});
		}

		websip.sipReject(false);
	}

	/* 기본 콜 제어 */

	// Main Call 발신
	MakeCall = (calledNum) => {
		let sessTimer = this.#_config.sessTimer;
		let turnInfo = this.#_config.iceServer;

		websip.sipCall(calledNum, sessTimer, turnInfo); // 전화 발신
	}

	// Main Call 종료
	EndCall = () => {
		websip.sipDisc();
	}

	// Main Call 보류
	HoldCall = () => {
		websip.sipHold();
	}

	// Main Call 보류해제
	UnHoldCall = () => {
		websip.sipUnhold();
	}

	/*************
	 * 협의콜 제어 *
	 **************/

	IsConsultCall = () => {
		return (websip.getConsultSession() != undefined);
	}

	HasCall = () => {
		return (websip.getCurSession() != undefined);
	}

	// 협의콜 발신
	ConsultMakeCall = (calledNum) => {
		let sessTimer = this.#_config.sessTimer;
		let turnInfo = this.#_config.iceServer;

		if (this.IsLocalHold()) {
			websip.sipConsultCall(calledNum, sessTimer, turnInfo);
			return
		}

		this.HoldCall()

		setTimeout(() => {
			websip.sipConsultCall(calledNum, sessTimer, turnInfo);
		}, 200);
	}

	// 협의콜 종료
	ConsultEndCall = () => {
		websip.sipConsultDisc();
	}

	// 협의콜 보류
	ConsultHoldCall = () => {
		websip.sipConsultHold();
	}

	// 협의콜 보류해제
	ConsultUnHoldCall = () => {
		websip.sipConsultUnhold();
	}

	/************
	 * 통화 제어 *
	 ************/

	// 호전환
	CallTransfer = (transfNum) => {
		websip.sipTransfer(transfNum);
	}

	// DTMF 송출
	SendDtmf = (dtmf) => {
		websip.sipSendDtmf(dtmf);
	}

	/* 미디어 제어 */

	// 음소거 켜기/끄기
	MuteOn = (on) => {
		if (on) websip.sideToneOn();
		else websip.sideToneOff();
	}

	// 음원 송출 시작
	PlayStart = () => {
		websip.playStart("./dream.mp3", false);
	}

	// 음원 송출 중지
	PlayStop = () => {
		websip.playStop();
	}

	// 0.0 ~ 1.0
	ChangeSpeakerVolume = (volume) => {
		websip.changeVolume(volume);
	}

	// 0.0 ~ 1.0
	ChangeSideToneVolume = (volume) => {
		websip.changeSideTone(volume);
	}
}

