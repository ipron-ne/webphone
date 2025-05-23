/*
 * Copyright (c) 2025 BridgeTech Inc.
 */
(function (myvar) {


    var justSip;
    var appControl;
    var userMediaAgc = true;
    var pushComplete = 0;
    var pushRetry = 5000;
    var pushTimer;
    var pushUrl;
    var pushStr;
    var mobConnectState = 0;
    var mobc2r_timer;
    var mobReserve = 0;
    var mobreg_state;
    var mobc1_state;
    var mobc2_state;
    var mobcr_state;
    var mob_def_calledNum;
    var mob_def_sessTimer;
    var mob_def_turn_info;
    var mob_def_register;
    var webcall_state = "idle";
    var serverDomain;
    var myNumber;
    var myId;
    var myPasswd;
    var regExpire;
    var iceTimeout;
    var user_agent;
    var logFunc;
    var callBackEvt={
        TransportConnected: null,
        TransportDisconnected: null,
        Registered: null,
        Unregistered: null,
        RegisterFailed: null,
        CallCreated: null,
        InboundReceived: null,
        InboundAccepted: null,
        InboundConnected: null,
        InboundFailed: null,
        InboundEnded: null,
        OutboundProgress: null,
        OutboundAccepted: null,
        OutboundConnected: null,
        OutboundFailed: null,
        OutboundEnded: null,
        ConsultSessionElevated: null,
        TransferRqSucceeded: null,
        TransferRqFailed: null,
        TransferProgress: null,
        TransferAccepted: null,
        TransferFailed: null,
        ReferReceived: null,
        NotifyReceived: null,
        ReinviteReceived: null,
        ReinviteAccepted: null,
        ReinviteFailed: null,
        ReinviteAckReceived: null,
        PlayStarted: null,
        PlayStopped: null,
    };
    var inAudio;
    var inAudioText;
    var outAudio;
    var outAudioText;
    var inAudioStream;
    var speakerVolume = 1.0;
    var sideToneVolume = 0.0;
    var audioElement;
    var audconElement;
    var aduioSideTone;
    var mikeMuted;
    var s1hold, s2hold;
    var t1hold, t2hold;
    var aud_play;
    var mix_aud;
    var android;
    var ios;

    var ua;
    var inSession;
    var outSession;
    var consultSession;
    var orgSession;
    var connectState;
    var initialized;


    myvar.sockInit = function(arg){
        if(initialized){
            slogwrite("already initialized");
            return ua;
        }
        initialized=1;
/*
        var index=arg.serverAddress.indexOf("://");
        var len=arg.serverAddress.length;
        if(index>=0)
            serverAddress = arg.serverAddress.slice(index+3, len);
        else
            serverAddress = arg.serverAddress;
*/
        justSip     = arg.justSip;
        appControl  = arg.appControl;
        serverDomain= arg.serverDomain;
        myNumber    = arg.myNumber;
        myId        = arg.myId;
        myPasswd    = arg.myPasswd;
        regExpire   = arg.regExpire;
        iceTimeout  = arg.iceTimeout;
        callBackEvt = arg.callBack;
        logFunc     = arg.logwrite;

        //user_agent = 'Goorme Webcall 2.0';  // IPRON Softphone v.1.1.26 까지 사용
        user_agent = 'IPRON_Softphone';  // KT-CCaaS 용 으로 변경(IPRON Softphone v.1.1.27 이상)
        if(arg.user_agent)
            user_agent = arg.user_agent;
        if(arg.speakerVolume)
            speakerVolume = arg.speakerVolume;
        if(arg.sideToneVolume)
            sideToneVolume = arg.sideToneVolume;

        if(!justSip){
            audioElement = document.createElement('audio');
            audconElement= document.createElement('audio');
            aduioSideTone= document.createElement('audio');
            audioElement.volume = speakerVolume;
            audconElement.volume = speakerVolume;
            aduioSideTone.volume = sideToneVolume;

            if('captureStream' in HTMLAudioElement.prototype){
                aud_play = new Audio();
                aud_play.addEventListener('pause', restoreInput2Mike);

                var asrc;
                var pstream = aud_play.captureStream();
                pstream.addEventListener('active', function(){
                    slogwrite("change audio input to play stream, overwrite: " + aud_play.overwrite + ", active: " + pstream.active);
                    if(callBackEvt.PlayStarted)
                        callBackEvt.PlayStarted();
                    if(!pstream.active){
                        //aud_play.pause();
                        //return;
                    }
                    mix_aud = undefined;
                    if(!aud_play.overwrite){
                        mix_aud = {};
                        mix_aud.actx = new AudioContext();
                        mix_aud.adst = mix_aud.actx.createMediaStreamDestination();

                        mix_aud.pgain = mix_aud.actx.createGain();
                        mix_aud.pgain.gain.value = aud_play.volume;

                        asrc = mix_aud.actx.createMediaStreamSource(pstream);
                        asrc.connect(mix_aud.pgain);
                        mix_aud.pgain.connect(mix_aud.adst);

                        asrc = mix_aud.actx.createMediaStreamSource(inAudioStream);
                        asrc.connect(mix_aud.adst);
                    }
                    [inSession, outSession, consultSession].forEach(function(sess){
                        if(sess){
                            if(mix_aud)
                                changeInput(sess, mix_aud.adst.stream);
                            else
                                changeInput(sess, pstream);
                        }
                    });
                });

                function restoreInput2Mike(){
                    slogwrite("play paused");
                    if(callBackEvt.PlayStopped)
                        callBackEvt.PlayStopped();
                    [inSession, outSession, consultSession].forEach(function(sess){
                        if(sess)
                            changeInput(sess, inAudioStream);
                    });

                    pstream.getAudioTracks().forEach(function(track){
                        pstream.removeTrack(track);
                    });

                    if(mix_aud){
                        mix_aud.adst.stream.getAudioTracks().forEach(function(track){
                            mix_aud.adst.stream.removeTrack(track);
                        });
                        mix_aud.actx = undefined;
                        mix_aud = undefined;
                    }
                }
            }
        }

        var dev;
        dev=navigator.userAgent.toLowerCase();
        if(dev.indexOf("android")>=0)
            android=1;
        if(dev.indexOf("iphone")>=0 || dev.indexOf("ipad")>=0 || dev.indexOf("ipod")>=0)
            ios=1;

        slogwrite(navigator.userAgent);
        slogwrite("appControl: " + appControl);
        slogwrite("android: " + android);
        slogwrite("ios: " + ios);

        myvar.changeAudioInputDevice(arg.inAudio, arg.inAudioText);
        myvar.changeAudioOutputDevice(arg.outAudio, arg.outAudioText);

        JsSIP.debug.enable('*');

        try{
            var socket = new JsSIP.WebSocketInterface(arg.serverAddress);
            var configuration = {
                sockets     : [ socket ],
                user_agent  : user_agent,
                uri         : 'sip:' + myNumber + '@' + serverDomain,
                contact_uri : 'sip:' + myNumber + '@dkanrjsk.invalid',
                authorization_user : myId,
                password    : myPasswd,
                register    : false,
                register_expires : regExpire,
                connection_recovery_min_interval : 1,
                connection_recovery_max_interval : 2,
            };

            if(justSip || android || ios)
                configuration.connection_recovery_max_interval = 1;

            ua = new JsSIP.UA(configuration);

            ua.on("connected", evtTransportConnected);
            ua.on("disconnected", evtTransportDisconnected);
            ua.on("registered", evtRegistered);
            ua.on("unregistered", evtUnregistered);
            ua.on("registrationFailed", evtRegisterFailed);
            ua.on("newRTCSession", evtCallCreated);
        }
        catch(err){
            slogwrite("sockInit failed, " + err);

            var s = {};
            s.event = "initiated";
            s.result = "fail";
            myvar.NotifyMobile(s);

            myvar.sockDestroy();
            return undefined;
        }

        var s = {};
        s.event = "initiated";
        s.result = "success";
        myvar.NotifyMobile(s);

        return ua;
    }

    myvar.sockDestroy = function(){
        if(!initialized)
            return;
        if(connectState)
            myvar.sockClose();

        if(!justSip){
            audioElement.remove();;
            audconElement.remove();
            aduioSideTone.remove();
        }

        if(inAudioStream){
            inAudioStream.getTracks().forEach(function (track) {
                track.stop();
            });
        }
    
        if(webcall_state != "idle"){
            var s = {};
            s.event = "idle";
            myvar.NotifyMobile(s);
            webcall_state = "idle";
        }

        var s = {};
        s.event = "destroyed";
        myvar.NotifyMobile(s);

        userMediaAgc = true;

        callBackEvt={
            TransportConnected: null,
            TransportDisconnected: null,
            Registered: null,
            Unregistered: null,
            RegisterFailed: null,
            CallCreated: null,
            InboundReceived: null,
            InboundAccepted: null,
            InboundConnected: null,
            InboundFailed: null,
            InboundEnded: null,
            OutboundProgress: null,
            OutboundAccepted: null,
            OutboundConnected: null,
            OutboundFailed: null,
            OutboundEnded: null,
            ConsultSessionElevated: null,
            TransferRqSucceeded: null,
            TransferRqFailed: null,
            TransferProgress: null,
            TransferAccepted: null,
            TransferFailed: null,
            ReferReceived: null,
            NotifyReceived: null,
            ReinviteReceived: null,
            ReinviteAccepted: null,
            ReinviteFailed: null,
            ReinviteAckReceived: null,
            PlayStarted: null,
            PlayStopped: null,
        };
            
        justSip = undefined;
        appControl = undefined;
        pushComplete = 0;
        pushRetry = 5000;
        if(pushTimer){
            clearTimeout(pushTimer);
            pushTimer = undefined;
        }
        pushUrl = undefined;
        pushStr = undefined;
        mobConnectState = 0;
        if(mobc2r_timer){
            clearTimeout(mobc2r_timer);
            mobc2r_timer = undefined;
        }
        mobReserve = 0;
        mobreg_state = undefined;
        mobc1_state = undefined;
        mobc2_state = undefined;
        mobcr_state = undefined;
        mob_def_register = undefined;
        mob_def_calledNum = undefined;
        mob_def_sessTimer = undefined;
        mob_def_turn_info = undefined;
        webcall_state = "idle";
        serverDomain = undefined;
        myNumber = undefined;
        myId = undefined;
        myPasswd = undefined;
        regExpire = undefined;
        iceTimeout = undefined;
        inAudio = undefined;
        inAudioText = undefined;
        outAudio = undefined;
        outAudioText = undefined;
        inAudioStream = undefined;
        speakerVolume = 1.0;
        sideToneVolume = 0.0;
        mikeMuted = undefined;
        s1hold = undefined;
        s2hold = undefined;
        t1hold = undefined;
        t2hold = undefined;
        myvar.playStop();
        aud_play = undefined;
        android = undefined;
        ios = undefined;
        ua = undefined;
        inSession = undefined;
        outSession = undefined;
        consultSession = undefined;
        orgSession = undefined;
        connectState = undefined;
        logFunc = undefined;

        initialized=0;
    }

    myvar.setUserMediaAgc = function (val) {
        if (typeof val == "string") val = parseInt(val);
        if (val) userMediaAgc = true;
        else userMediaAgc = false;
        slogwrite("userMediaAgc: " + val);
    }

    myvar.setPushToken = function(url, jstr){
        slogwrite("setPushToken: url=" + url + ", json=" + jstr);
        pushUrl = url;
        pushStr = jstr;
        if(pushComplete === 1)
            SendPushToken();
        else
            myvar.Connect2Register();
    }

    function SendPushToken(){
        if(pushTimer){
            clearTimeout(pushTimer);
            pushTimer = undefined;
        }
        pushComplete = 2;
        slogwrite("SendPushToken: url=" + pushUrl + ", json=" + pushStr);
        var opt = {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: pushStr,
        };
        var status;
        fetch(pushUrl, opt).then(function(response){
            status = response.status;
            slogwrite("SendPushToken resp status: " + status);
            return response.json();
        }).then(function(data){
            slogwrite("SendPushToken resp body: " + JSON.stringify(data));
            if(status === 200)
                pushComplete = 3;
            else{
                pushTimer = setTimeout(SendPushToken, pushRetry);
                pushRetry *= 2;
                if(pushRetry>3600000)
                    pushRetry = 3600000;
            }
        }).catch(function(err){
            slogwrite("SendPushToken " + err);
            pushTimer = setTimeout(SendPushToken, pushRetry);
            pushRetry *= 2;
            if(pushRetry>3600000)
                pushRetry = 3600000;
        });
    }

    myvar.NotifyMobile = function(s){
        if(!appControl)
            return;

        var str = notijson(s);
        slogwrite("json2app " + str);
        if(android && window.AndroidInterface)
            window.AndroidInterface.OnMessage(str);
        if(ios && window.webkit)
            window.webkit.messageHandlers.owms.postMessage(str);
    }

    myvar.dump = function(){
        var cache = [];

        function jreplacer (key, value){
            if (typeof value === 'object' && value !== null) {
                if (cache.indexOf(value) !== -1) {
                    return
                }
                cache.push(value)
            }
//            if(key === '_ua')
//                return;
//            if(key === '_dialogs')
//                return;
            return value;
        }

        function jdump(n, v){
//            cache = [];
            var str = JSON.stringify(v, jreplacer, '\t');
            slogwrite(n + " " + str)
//            cache = null;
        }

        jdump("ua", ua);
        if(inSession)
            jdump("inSession", inSession._id);
        if(outSession)
            jdump("outSession", outSession._id);
        if(consultSession)
            jdump("consultSession", consultSession._id);
        jdump("appControl", appControl);
        jdump("userMediaAgc", userMediaAgc);
        jdump("android", android);
        jdump("ios", ios);
        jdump("inAudio", inAudio);
        jdump("inAudioText", inAudioText);
        jdump("outAudio", outAudio);
        jdump("outAudioText", outAudioText);
        jdump("mikeMuted", mikeMuted);
        jdump("s1hold", s1hold);
        jdump("s2hold", s2hold);
        jdump("t1hold", t1hold);
        jdump("t2hold", t2hold);
        jdump("speakerVolume", speakerVolume);
        jdump("sideToneVolume", sideToneVolume);
        jdump("aud_play", aud_play);
        jdump("mix_aud", mix_aud);
        jdump("connectState", connectState);
        jdump("mobConnectState", mobConnectState);
        jdump("mobReserve", mobReserve);
        jdump("mobreg_state", mobreg_state);
        jdump("mobc1_state", mobc1_state);
        jdump("mobc2_state", mobc2_state);
        jdump("mobcr_state", mobcr_state);
        jdump("webcall_state", webcall_state);
        if(pushUrl && pushStr){
            jdump("pushComplete", pushComplete);
            jdump("pushUrl", pushUrl);
            jdump("pushStr", pushStr);
        }
        jdump("navigator.userAgent", navigator.userAgent);

        cache = null;
    }

    myvar.mikeMute = function(){
        if(justSip)
            return;
        if(mikeMuted)
            return;
        mikeMuted = true;
        if(inSession)
            inSession.mute();
        if(outSession)
            outSession.mute();
        if(consultSession)
            consultSession.mute();
    }

    myvar.mikeUnmute = function(){
        if(justSip)
            return;
        if(!mikeMuted)
            return;
        mikeMuted = false;
        if(inSession && !s1hold)
            inSession.unmute();
        if(outSession && !s1hold)
            outSession.unmute();
        if(consultSession && !s2hold)
            consultSession.unmute();
    }

    myvar.sockConnect = function(){
        mobConnectState = 1;
        if(connectState && ua.isConnected()){
            slogwrite("already connected");
            return;
        }
        sockStartState();
    }

    myvar.sockClose = function(){
        if(ua._status === ua.C.STATUS_USER_CLOSED){
            mobConnectState = 0;
            connectState = 0;
            return;
        }
        sockClearState();
    }

    function sockStartState(){
        if(connectState){
            ua.stop();
            slogwrite("canceled previous connect and reconnecting");
        }
        connectState=1;
        ua.start();
    }

    function sockClearState(){
        mobreg_state = undefined;
        mobConnectState = -1;
        ua.stop();
        connectState=0;
    }

    myvar.changeVolume = function(volume){
        if(justSip)
            return;

        speakerVolume = volume;
        audioElement.volume = speakerVolume;
        audconElement.volume = speakerVolume;
    }

    myvar.changeSideTone = function(volume){
        if(justSip)
            return;

        sideToneVolume = volume;
        aduioSideTone.volume = sideToneVolume;
    }

    myvar.sideToneOn = function(){
        if(!initialized)
            return;
        if(justSip)
            return;

        aduioSideTone.muted = false;
    }

    myvar.sideToneOff = function(){
        if(!initialized)
            return;
        if(justSip)
            return;

        aduioSideTone.muted = true;
    }

    myvar.playStart = function(fileurl, overwrite){
        if(!aud_play)
            return;
        if(!aud_play.paused)
            return;

        aud_play.overwrite = overwrite;
        aud_play.setAttribute("src", fileurl);
        aud_play.load();
        aud_play.play().catch(function(e){
            slogwrite("play failed: " + e);
            aud_play.pause();
        });
    }

    myvar.playStop = function(){
        if(!aud_play)
            return;
        if(aud_play.paused)
            return;

        aud_play.pause();
    }

    myvar.playVolume = function(volume){
        if(!aud_play)
            return;

        aud_play.volume = volume;
        if(mix_aud)
            mix_aud.pgain.gain.value = volume;
    }

    myvar.changeAudioInputDevice = function(grmInAudio, grmInText){
        if(!initialized)
            return;
        if(justSip)
            return;

        if(inAudioStream){
            inAudioStream.getTracks().forEach(function (track) {
                track.stop();
            });
        }
        inAudioStream = undefined;
        [inSession, outSession, consultSession].forEach(function(sess){
            if(sess)
                SessionTrackStop(sess);
        });

        inAudio = grmInAudio;
        inAudioText = grmInText;
        slogwrite("inAudio:  " + grmInText + ", " + grmInAudio);
/*        
        var s = {};
        s.event = "audio_input_device";
        s.deviceid = inAudio;
        s.devicetext = inAudioText;
        myvar.NotifyMobile(s);
*/
        if('sinkId' in HTMLMediaElement.prototype)
            myGetUserMedia();
        else
            setTimeout(myGetUserMedia, 10);

        function myGetUserMedia(){
            var constraints = {};
            if(grmInAudio)
                constraints.audio = {
					deviceId: { exact: grmInAudio },
					autoGainControl: userMediaAgc,
				 };
            else
                constraints.audio = { autoGainControl: userMediaAgc };
            navigator.mediaDevices.getUserMedia(constraints).then(function (stream){
                inAudioStream = stream;
                aduioSideTone.srcObject = inAudioStream;
                CheckCallSideTone();
                aduioSideTone.volume = sideToneVolume;
                aduioSideTone.play().catch(function(e) {console.log("[myGetUserMedia] aduioSideTone.play exception: ", e)});
                slogwrite("getUserMedia succeed");
                [inSession, outSession, consultSession].forEach(function(sess){
                    if(sess)
                        changeInput(sess, inAudioStream);
                });
            })["catch"](function (err){
                slogwrite("getUserMedia failed: " + err);
                return;
            });
        };
    }

    myvar.changeAudioOutputDevice = function(grmOutAudio, grmOutText){
        if(!initialized)
            return;
        if(justSip)
            return;

        outAudio = grmOutAudio;
        outAudioText = grmOutText;
        slogwrite("outAudio: " + grmOutText + ", " + grmOutAudio);
/*
        var s = {};
        s.event = "audio_output_device";
        s.deviceid = outAudio;
        s.devicetext = outAudioText;
        myvar.NotifyMobile(s);
*/
        if(!('sinkId' in HTMLMediaElement.prototype)){
            slogwrite("setSinkId not supported")
            return;
        }

        audioElement.setSinkId(grmOutAudio).then(function(result){
            slogwrite("setSinkId(audio) succeed");
        }).catch(function(err){
            slogwrite("setSinkId(audio) failed: " + err);
            return;
        });
        audconElement.setSinkId(grmOutAudio).then(function(result){
            slogwrite("setSinkId(consult) succeed");
        }).catch(function(err){
            slogwrite("setSinkId(consult) failed: " + err);
            return;
        });
        aduioSideTone.setSinkId(grmOutAudio).then(function(result){
            aduioSideTone.srcObject = inAudioStream;
            CheckCallSideTone();
            aduioSideTone.volume = sideToneVolume;
            aduioSideTone.play().catch(function(e) {console.log("[changeAudioOutputDevice] aduioSideTone.play exception: ", e)});
            slogwrite("setSinkId(sidetone) succeed");
        }).catch(function(err){
            slogwrite("setSinkId(sidetone) failed: " + err);
            return;
        });
        if(aud_play){
            aud_play.setSinkId(grmOutAudio).then(function(result){
                slogwrite("setSinkId(play) succeed");
            }).catch(function(err){
                slogwrite("setSinkId(play) failed: " + err);
                return;
            });
        }
    }

    myvar.sipRegister = function(){
        ua.register();
    }

    myvar.sipUnregister = function(){
        ua.unregister();
    }

    function myCall(grmCalledNum, grmSessTimer, grmTurnInfo, nativeSdp, isConsult){
        // Register callbacks to desired call events
        var eventHandlers = {
            'progress'  : evtOutboundProgress,
            'accepted'  : evtOutboundAccepted,
            'confirmed' : evtOutboundConnected,
            'failed'    : evtOutboundFailed,
            'ended'     : evtOutboundEnded,
        };
        var callOptions = {
            'eventHandlers'         : eventHandlers,
            'pcConfig'              : { 'iceServers': [] },
            'mediaStream'           : inAudioStream,
            'mediaConstraints'      : { 'audio': true, 'video': false },
            'rtcOfferConstraints'   : { 'offerToReceiveAudio': true, 'offerToReceiveVideo': false },
            'sessionTimersExpires'  : grmSessTimer,
        };
        if(grmTurnInfo)
        for (var i = 0; i < grmTurnInfo.length; i++) {
            callOptions.pcConfig.iceServers[i] = {
                urls: "turn:" + grmTurnInfo[i].turnAddress,
                username: grmTurnInfo[i].turnId,
                credential: grmTurnInfo[i].turnPasswd,
            };
        }

        var data = {
            isConsult : isConsult,
            iceServers: callOptions.pcConfig.iceServers,
            nativeSdp: nativeSdp,
        };
        callOptions.data = data;

        var session;
        if(isConsult){
            consultSession = ua.call('sip:' + grmCalledNum + '@' + serverDomain, callOptions);
            if(consultSession.isEnded()){
                consultSession = undefined;
                return;
            }
            session = consultSession;
        }
        else{
            outSession = ua.call('sip:' + grmCalledNum + '@' + serverDomain, callOptions);
            if(outSession.isEnded()){
                outSession = undefined;
                return;
            }
            session = outSession;
        }
        if(!justSip){
            session.connection.addEventListener('track', function (e){
                playSession(session, e);
            });
        }
    }

    myvar.Connect2Call = function(grmCalledNum, grmSessTimer, grmTurnInfo, register){
        if(!initialized){
            slogwrite("not initialized");
            return;
        }
        if(mobConnectState < 0){
            slogwrite("can't make call: websocket will be disconnected");
            return;
        }
        if(mobc1_state){
            slogwrite("can't make call: already call exists");
            return;
        }
        if(outSession || inSession){
            slogwrite("can't make call: not in null state");
            return;
        }
        if(consultSession){
            slogwrite("can't make call: consult call exists");
            return;
        }

        mobc1_state = "call_requested";
        if(connectState && ua.isConnected()){
            if(register && !ua.isRegistered()){
                mobc1_state = "regi_started";
                ua.register();
            }
            else
                myvar.sipCall(grmCalledNum, grmSessTimer, grmTurnInfo);
        }
        else{
            mobc1_state = "connecting";
            mob_def_register = register;
            mob_def_calledNum = grmCalledNum;
            mob_def_sessTimer = grmSessTimer;
            mob_def_turn_info = grmTurnInfo;
            if(!mobConnectState){
                mobConnectState = 2;
                sockStartState();
            }
        }
    }

    myvar.Connect2Register = function(){
        if(!initialized){
            slogwrite("not initialized");
            return;
        }
        if(mobConnectState < 0){
            slogwrite("can't recv call: socket disconnecting, recv reserved");
            mobReserve = 1;
            return;
        }
        mobreg_state = "connecting";
        if(connectState && ua.isConnected()){
            mobreg_state = "regi_started";
            ua.register();
        }
        else{
            if(!mobConnectState){
                mobConnectState = 3;
                sockStartState();
            }
        }
        if(mobc2r_timer)
            clearTimeout(mobc2r_timer);
        mobc2r_timer = setTimeout(function(){
            mobc2r_timer = undefined;
            if(!mobc1_state && !mobc2_state && !mobcr_state){
                if(mobConnectState === 3){
                    slogwrite("no inbound call, connection cleared.");
                    sockClearState();
                }
            }
        }, 30000);
    }

    myvar.SystemCallConnected = function(){
        slogwrite("SystemCallConnected");
        [inSession, outSession, consultSession].forEach(function(item){
            if(item){
                if(!item.isEstablished())
                    item.terminate();
            }
        });
        if(inSession || outSession)
            myvar.sipHold(1);
        if(consultSession)
            myvar.sipConsultHold(1);
    }

    myvar.SystemCallDisconnected = function(){
        slogwrite("SystemCallDisconnected");
        if(inSession || outSession)
            myvar.sipUnhold(1);
        if(consultSession)
            myvar.sipConsultUnhold(1);
    }

    myvar.sipCall = function(grmCalledNum, grmSessTimer, grmTurnInfo, nativeSdp){
        if(outSession || inSession){
            slogwrite("can't make call: not in null state");
            return  "fail";
        }
        if(consultSession){
            slogwrite("can't make call: consult call exists");
            return  "fail";
        }

        var s = {};
        s.event = "calling";
        myvar.NotifyMobile(s);
        webcall_state = "calling";

        mobc1_state = "calling";
        myCall(grmCalledNum, grmSessTimer, grmTurnInfo, nativeSdp, false);
    }

    myvar.sipDisc = function(){
    //  ua.terminateSessions();
        if(mobc1_state === "connecting"){
            mobc1_state = undefined;
            if(mobConnectState === 2)
                sockClearState();
            return;
        }
        if(!outSession && !inSession){
            slogwrite("nothing to disc");
            return;
        }
        
        var session;
        if(inSession && !inSession._data.isConsult)
            session = inSession;

        if(outSession && !outSession._data.isConsult)
            outSession.terminate();
        if(session)
            session.terminate();
    }

    myvar.sipAccept = function(grmSessTimer, grmTurnInfo, nativeSdp, isConsult){
        var session;
        if(isConsult)
            session = consultSession;
        else
            session = inSession;
        if(!session || session._status != session.C.STATUS_WAITING_FOR_ANSWER){
            slogwrite("nothing to accept")
            return;
        }

        var callOptions = {
            'pcConfig'              : { 'iceServers': [] },
            'mediaStream'           : inAudioStream,
            'mediaConstraints'      : { 'audio': true, 'video': false },
            'rtcOfferConstraints'   : { 'offerToReceiveAudio': true, 'offerToReceiveVideo': false },
            'sessionTimersExpires'  : grmSessTimer,
        };
        if(grmTurnInfo)
        for (var i = 0; i < grmTurnInfo.length; i++) {
            callOptions.pcConfig.iceServers[i] = {
                urls: "turn:" + grmTurnInfo[i].turnAddress,
                username: grmTurnInfo[i].turnId,
                credential: grmTurnInfo[i].turnPasswd,
            };
        }

        var data = {
            isConsult : isConsult,
            iceServers: callOptions.pcConfig.iceServers,
            nativeSdp: nativeSdp,
            replace: session._data.replace,
        };
        callOptions.data = data;

        session.answer(callOptions);
    }

    myvar.sipReject = function(isConsult){
        var session;
        if(isConsult)
            session = consultSession;
        else
            session = inSession;
        if(!session || session._status != session.C.STATUS_WAITING_FOR_ANSWER){
            slogwrite("nothing to reject");
            return;
        }
        session.terminate();
    }

    myvar.sipHold = function(tel){
        if(justSip)
            return;
        if(!inSession && !outSession){
            if(!tel)
                slogwrite("nothing to hold");
            return;
        }
        if(inSession){
            inSession.hold();
            inSession.mute();
        }
        if(outSession){
            outSession.hold();
            outSession.mute();
        }
        audioElement.pause();

        if(tel)
            t1hold = true;
        else
            s1hold = true;
        CheckCallSideTone();
    }

    myvar.sipUnhold = function(tel){
        if(justSip)
            return;
        if(!inSession && !outSession){
            if(!tel)
                slogwrite("nothing to unhold");
            return;
        }
        if(tel)
            t1hold = false;
        else
            s1hold = false;
        if(!t1hold && !s1hold){
            if(inSession){
                inSession.unhold();
                if(!mikeMuted)
                    inSession.unmute();
            }
            if(outSession){
                outSession.unhold();
                if(!mikeMuted)
                    outSession.unmute();
            }
            audioElement.play().catch(function(e) {console.log("[sipUnhold] audioElement.play exception: ", e)});
            aduioSideTone.muted = false;
        }
    }

    myvar.sipReinvite = function(nativeSdp){
        if(!inSession && !outSession){
            slogwrite("nothing to reinvite");
            return;
        }
        var callOptions = {
            'rtcOfferConstraints'   : { 'offerToReceiveAudio': true, 'offerToReceiveVideo': false },
        };
        var data = {
            nativeSdp: nativeSdp,
        };
        callOptions.data = data;
        if(inSession)
            inSession.renegotiate(callOptions);
        if(outSession)
            outSession.renegotiate(callOptions);
    }

    myvar.sipReinvAccept = function(nativeSdp){
        if(!inSession && !outSession){
            slogwrite("nothing to reinvite accept");
            return;
        }
        var event = new CustomEvent("reinvresp", { "detail": nativeSdp });
        if(inSession && inSession.myebus)
            inSession.myebus.dispatchEvent(event);
        if(outSession && outSession.myebus)
            outSession.myebus.dispatchEvent(event);
    }

    myvar.sipConsultCall = function(grmCalledNum, grmSessTimer, grmTurnInfo, nativeSdp){
        if( (!outSession || !outSession.isEstablished()) &&
            (!inSession  || !inSession.isEstablished()) ){
            slogwrite("can't make consult call: no call exists");
            return  "fail";
        }
        if(consultSession){
            slogwrite("can't make consult call: consult call exists");
            return  "fail";
        }
        mobc2_state = "calling";
        myCall(grmCalledNum, grmSessTimer, grmTurnInfo, nativeSdp, true);
    }

    myvar.sipConsultDisc = function(){
        if(!consultSession){
            slogwrite("no consult to disc");
            return;
        }
        consultSession.terminate();
    }

    myvar.sipConsultHold = function(tel){
        if(justSip)
            return;
        if(!consultSession){
            if(!tel)
                slogwrite("no consult to hold");
            return;
        }
        consultSession.hold();
        consultSession.mute();
        audconElement.pause();

        if(tel)
            t2hold = true;
        else
            s2hold = true;
        CheckCallSideTone();
    }

    myvar.sipConsultUnhold = function(tel){
        if(justSip)
            return;
        if(!consultSession){
            if(!tel)
                slogwrite("no consult to unhold");
            return;
        }
        if(tel)
            t2hold = false;
        else
            s2hold = false;
        if(!t2hold && !s2hold){
            consultSession.unhold();
            if(!mikeMuted)
                consultSession.unmute();
            audconElement.play().catch(function(e) {console.log("[sipConsultUnhold] audconElement.play exception: ", e)});
            aduioSideTone.muted = false;
        }
    }

    myvar.sipConsultReinvite = function(nativeSdp){
        if(!consultSession){
            slogwrite("no consult to reinvite");
            return;
        }
        var callOptions = {
            'rtcOfferConstraints'   : { 'offerToReceiveAudio': true, 'offerToReceiveVideo': false },
        };
        var data = {
            nativeSdp: nativeSdp,
        };
        callOptions.data = data;
        consultSession.renegotiate(callOptions);
    }

    myvar.sipConsultReinvAccept = function(nativeSdp){
        if(!consultSession){
            slogwrite("no consult to reinvite");
            return;
        }
        var event = new CustomEvent("reinvresp", { "detail": nativeSdp });
        if(consultSession.myebus)
            consultSession.myebus.dispatchEvent(event);
    }

    myvar.sipTransfer = function(grmTransfNum){
        if(!outSession && !inSession){
            slogwrite("can't transfer: no call exists");
            return;
        }

        var target = 'sip:' + grmTransfNum + '@' + serverDomain;
        var options = {
            replaces: consultSession,
            eventHandlers: {
                'requestSucceeded'  : evtTransferRqSucceeded,
                'requestFailed'     : evtTransferRqFailed,
                'progress'          : evtTransferProgress,
                'accepted'          : evtTransferAccepted,
                'failed'            : evtTransferFailed,
            },
        };
        if(inSession && inSession._status === inSession.C.STATUS_CONFIRMED)
            inSession.refer(target, options);
        if(outSession && outSession._status === outSession.C.STATUS_CONFIRMED)
            outSession.refer(target, options);
    }

    myvar.sipSendDtmf = function(dtmf){
        if(!dtmf)
            return;

        var muted;
        var options = {
            'transportType' : 'RFC2833',
            'duration'      : 100,
            'interToneGap'  : 50,
        };
        [inSession, outSession, consultSession].forEach(function(item, i, arr){
            if(item){
                muted = item.isMuted();
                if(!muted.audio)
                    item.sendDTMF(dtmf, options);
            }
        });
    }

    myvar.getCurSession = function(){
        if(inSession)
            return inSession;
        if(outSession)
            return outSession;
        return undefined;
    }

    myvar.getConsultSession = function(){
        return consultSession;
    }

    function evtTransportConnected(evt){
        if(callBackEvt.TransportConnected)
            callBackEvt.TransportConnected(evt);
        if(mobreg_state === "connecting"){
            mobreg_state = "regi_started";
            ua.register();
        }
        if(mobc1_state === "connecting"){
            if(mob_def_register && !ua.isRegistered()){
                mobc1_state = "regi_started";
                ua.register();
            }
            else
                myvar.sipCall(mob_def_calledNum, mob_def_sessTimer, mob_def_turn_info);
        }
    }

    function evtTransportDisconnected(evt){
        if(callBackEvt.TransportDisconnected)
            callBackEvt.TransportDisconnected(evt);
        //if(mobreg_state === "connecting"){
        if(!mobc1_state && !mobc2_state && !mobcr_state){
            if(mobConnectState === 3)
                sockClearState();
        }
        if(mobc1_state === "connecting"){
            mobc1_state = undefined;
            if(mobConnectState === 2)
                sockClearState();
        }
        if(mobConnectState === 1 || mobConnectState === -1)
            mobConnectState = 0;

        if(mobReserve){
            mobReserve = 0;
            myvar.Connect2Register();
        }
    }

    function evtRegistered(evt){
        if(callBackEvt.Registered)
            callBackEvt.Registered(evt);
        if(mobc1_state === "regi_started")
            myvar.sipCall(mob_def_calledNum, mob_def_sessTimer, mob_def_turn_info);
        if(!pushComplete){
            pushComplete = 1;
            if(pushUrl && pushStr)
                SendPushToken();
        }
    }

    function evtUnregistered(evt){
        if(callBackEvt.Unregistered)
            callBackEvt.Unregistered(evt);
        mobreg_state = undefined;
    }

    function evtRegisterFailed(evt){
        if(callBackEvt.RegisterFailed)
            callBackEvt.RegisterFailed(evt);
        mobreg_state = undefined;
        if(mobConnectState === 3)
            sockClearState();
        if(mobc1_state === "regi_started")
            myvar.sipCall(mob_def_calledNum, mob_def_sessTimer, mob_def_turn_info);
    }

    function evtCallCreatedRefer(nsession){
        nsession._data.isConsult = true;
        consultSession = nsession;
        if(!justSip){
            nsession.connection.addEventListener('track', function (e){
                playSession(nsession, e);
            });
        }
    }

    function evtCallCreatedReplace(nsession){
        nsession._data.replace = true;
        if(orgSession)
            nsession._data.isConsult = orgSession._data.isConsult;
    }

    function evtCallCreated(evt){
        var nsession = evt.session;

        if(!nsession._data.replace)
        if(nsession.direction === "incoming"){
            if(outSession || inSession){
                if(consultSession){
                    slogwrite("can't create inbound call: not in null state");
                    nsession.terminate({status_code:486});
                    return;
                }
                var alert = nsession._request.getHeader("Alert-Info");
                if(alert !== "auto-answer"){
                    slogwrite("can't create inbound call: not in null state");
                    nsession.terminate({status_code:486});
                    return;
                }
                nsession._data.isConsult = true;
            }
        }

        var isConsult = nsession._data.isConsult;

        if(!justSip){
            aduioSideTone.muted = false;
            if(mikeMuted)
                nsession.mute();
        }

        if(callBackEvt.CallCreated)
            callBackEvt.CallCreated(evt);

        nsession.on("refer", function(data){
            if(consultSession){
                slogwrite("refer rejected: consult call exists");
                data.reject();
            }
            else{
                if(callBackEvt.ReferReceived)
                    callBackEvt.ReferReceived(nsession, data.request);
                var eventHandlers = {
                    'progress'  : evtOutboundProgress,
                    'accepted'  : evtOutboundAccepted,
                    'confirmed' : evtOutboundConnected,
                    'failed'    : evtOutboundFailed,
                    'ended'     : evtOutboundEnded,
                };
                var callOptions = {
                    'eventHandlers'         : eventHandlers,
                    'pcConfig'              : nsession._data.iceServers,
                    'mediaStream'           : inAudioStream,
                    'mediaConstraints'      : { 'audio': true, 'video': false },
                    'rtcOfferConstraints'   : { 'offerToReceiveAudio': true, 'offerToReceiveVideo': false },
                    'sessionTimersExpires'  : nsession._sessionTimers.defaultExpires,
                };
                data.accept(evtCallCreatedRefer, callOptions);
            }
        });
        nsession.on("replaces", function(data){
            slogwrite("replace invite received");
            orgSession = nsession;
            data.accept(evtCallCreatedReplace);
        });
        nsession.on("icecandidate", function(candidate, ready){
        //    slogwrite("getting " + candidate.candidate.candidate);
            if(nsession._data.iceTimeout)
                clearTimeout(nsession._data.iceTimeout);
            nsession._data.iceTimeout = setTimeout(candidate.ready, iceTimeout);
        });
        nsession.on("notify", function(data){
            if(callBackEvt.NotifyReceived){
                callBackEvt.NotifyReceived(nsession, data);
                return;
            }

            if(justSip){
                data.reject();
                return;
            }

            var event = data.request.event.event;
            slogwrite("evtNotify: " + event);
            if(event === "hold"){
                if(nsession === consultSession)
                    data.callback = myvar.sipConsultHold;
                else
                    data.callback = myvar.sipHold;
            }
            else if(event === "talk"){
                if(nsession === consultSession)
                    data.callback = myvar.sipConsultUnhold;
                else
                    data.callback = myvar.sipUnhold;
            }
            else
                data.reject();
        });
        nsession.on("reinvite", function(data){
            if(callBackEvt.ReinviteReceived)
                callBackEvt.ReinviteReceived(nsession, data);
        });
        nsession.on("reinviteaccepted", function(data){
            if(callBackEvt.ReinviteAccepted)
                callBackEvt.ReinviteAccepted(nsession, data);
        });
        nsession.on("reinvitefailed", function(data){
            if(callBackEvt.ReinviteFailed)
                callBackEvt.ReinviteFailed(nsession, data);
        });
        nsession.on("reinviteack", function(data){
            if(callBackEvt.ReinviteAckReceived)
                callBackEvt.ReinviteAckReceived(nsession, data);
        });
        nsession.on("rtcreconnect", function(){
            slogwrite("rtcreconnect, isConsult: " + isConsult);
            nsession.connection.addEventListener('track', function (e){
                playSession(nsession, e);
            });
        });

        if(nsession.direction != "incoming")
            return;

        nsession.on("accepted", evtInboundAccepted);
        nsession.on("confirmed", evtInboundConnected);
        nsession.on("failed", evtInboundFailed);
        nsession.on("ended", evtInboundEnded);
        if(!justSip){
            nsession.on("peerconnection", function(evt){
                evt.peerconnection.addEventListener('track', function (e){
                    playSession(nsession, e);
                });
            });
        }

        if(isConsult)
            consultSession = nsession;
        else
            inSession = nsession;
        if(callBackEvt.InboundReceived)
            callBackEvt.InboundReceived(nsession, evt);
        if (nsession._data.replace){
            if(isConsult)
                mobcr_state = "called_consult";
            else
                mobcr_state = "called";
        }
        else if (isConsult)
            mobc2_state = "called";
        else
            mobc1_state = "called";

        if(webcall_state != "connected")
            webcall_state = "called";
    }

    function evtInboundAccepted(evt){
        if(callBackEvt.InboundAccepted)
            callBackEvt.InboundAccepted(this, evt);
    }

    function evtInboundConnected(evt){
        if(callBackEvt.InboundConnected)
            callBackEvt.InboundConnected(this, evt);
        if (this._data.replace){
            if(mobcr_state === "called_consult")
                mobc2_state = "called";
            else
                mobc1_state = mobcr_state;
            mobcr_state = undefined;
        }

        if(this._data.replace)
            this._data.replace = undefined;

        orgSession = undefined;

        if(webcall_state != "connected"){
            var s = {};
            s.event = "connected";
            myvar.NotifyMobile(s);
            webcall_state = "connected";
        }
    }

    function evtInboundFailed(evt){
        var isConsult = this._data.isConsult;
        if(this._data.replace){
            if(isConsult)
                consultSession = undefined;
            else
                inSession = undefined;
            if(orgSession){
                if(orgSession._data.isConsult)
                    consultSession = orgSession;
                else{
                    if(orgSession.direction === "incoming")
                        inSession = orgSession;
                    else
                        outSession = orgSession;
                }
                orgSession = undefined;
            }
        }
        else{
            if(isConsult){
                consultSession = undefined;
                if(!justSip)
                    audconElement.load();
            }
            else{
                inSession = undefined;
                if(!justSip)
                    audioElement.load();
            }
        }
        if(callBackEvt.InboundFailed)
            callBackEvt.InboundFailed(this, evt);
        if (this._data.replace)
            mobcr_state = undefined;
        else if (isConsult)
            mobc2_state = undefined;
        else
            mobc1_state = undefined;
        mobreg_state = undefined;
        if(!mobc1_state && !mobc2_state && !mobcr_state)
        if(mobConnectState === 2 || mobConnectState === 3)
            sockClearState();

        if(isConsult)
            s2hold = false;
        else
            s1hold = false;

        if(consultSession && !inSession && !outSession)
            elevateSession();

        CheckCallSideTone();

        if(!inSession && !outSession)
        if(webcall_state != "idle"){
            var s = {};
            s.event = "idle";
            myvar.NotifyMobile(s);
            webcall_state = "idle";
        }
    }

    function evtInboundEnded(evt){
        var isConsult = this._data.isConsult;
        if(this._data.replace){
            if(isConsult)
                consultSession = undefined;
            else
                inSession = undefined;
            if(orgSession){
                if(orgSession._data.isConsult)
                    consultSession = orgSession;
                else{
                    if(orgSession.direction === "incoming")
                        inSession = orgSession;
                    else
                        outSession = orgSession;
                }
                orgSession = undefined;
            }
        }
        else{
            if(isConsult){
                if(this === orgSession)
                    orgSession = undefined;
                else{
                    consultSession = undefined;
                    if(!justSip)
                        audconElement.load();
                }
            }
            else{
                if(this === orgSession)
                    orgSession = undefined;
                else{
                    inSession = undefined;
                    if(!justSip)
                        audioElement.load();
                }
            }
        }
        if(callBackEvt.InboundEnded)
            callBackEvt.InboundEnded(this, evt);
        if (this._data.replace)
            mobcr_state = undefined;
        else if (isConsult)
            mobc2_state = undefined;
        else
            mobc1_state = undefined;
        mobreg_state = undefined;
        if(!mobc1_state && !mobc2_state && !mobcr_state)
        if(mobConnectState === 2 || mobConnectState === 3)
            sockClearState();

        if(isConsult)
            s2hold = false;
        else
            s1hold = false;
            
        if(consultSession && !inSession && !outSession)
            elevateSession();

        CheckCallSideTone();

        if(!inSession && !outSession)
        if(webcall_state != "idle"){
            var s = {};
            s.event = "idle";
            myvar.NotifyMobile(s);
            webcall_state = "idle";
        }
    }

    function evtOutboundProgress(evt){
        if(callBackEvt.OutboundProgress)
            callBackEvt.OutboundProgress(this, evt);
    }

    function evtOutboundAccepted(evt){
        if(callBackEvt.OutboundAccepted)
            callBackEvt.OutboundAccepted(this, evt);
    }

    function evtOutboundConnected(evt){
        if(callBackEvt.OutboundConnected)
            callBackEvt.OutboundConnected(this, evt);

        if(webcall_state != "connected"){
            var s = {};
            s.event = "connected";
            myvar.NotifyMobile(s);
            webcall_state = "connected";
        }
    }

    function evtOutboundFailed(evt){
        var isConsult = this._data.isConsult;
        if(isConsult){
            consultSession = undefined;
            if(!justSip)
                audconElement.load();
        }
        else{
            outSession = undefined;
            if(!justSip)
                audioElement.load();
        }
        if(callBackEvt.OutboundFailed)
            callBackEvt.OutboundFailed(this, evt);
        if(isConsult)
            mobc2_state = undefined;
        else
            mobc1_state = undefined;
        mobreg_state = undefined;
        if(!mobc1_state && !mobc2_state)
        if(mobConnectState === 2 || mobConnectState === 3)
            sockClearState();

        if(isConsult)
            s2hold = false;
        else
            s1hold = false;

        CheckCallSideTone();

        if(!inSession && !outSession)
        if(webcall_state != "idle"){
            var s = {};
            s.event = "idle";
            myvar.NotifyMobile(s);
            webcall_state = "idle";
        }
    }

    function evtOutboundEnded(evt){
        var isConsult = this._data.isConsult;
        if(isConsult){
            if(this === orgSession)
                orgSession = undefined;
            else{
                consultSession = undefined;
                if(!justSip)
                    audconElement.load();
            }
        }
        else{
            outSession = undefined;
            if(this === orgSession)
                orgSession = undefined;
            else{
                if(!justSip)
                    audioElement.load();
            }
        }
        if(callBackEvt.OutboundEnded)
            callBackEvt.OutboundEnded(this, evt);
        if(isConsult)
            mobc2_state = undefined;
        else
            mobc1_state = undefined;
        mobreg_state = undefined;
        if(!mobc1_state && !mobc2_state && !mobcr_state)
        if(mobConnectState === 2 || mobConnectState === 3)
            sockClearState();

        if(isConsult)
            s2hold = false;
        else
            s1hold = false;

        if(consultSession && !inSession && !outSession)
            elevateSession();

        CheckCallSideTone();

        if(!inSession && !outSession)
        if(webcall_state != "idle"){
            var s = {};
            s.event = "idle";
            myvar.NotifyMobile(s);
            webcall_state = "idle";
        }
    }

    function evtTransferRqSucceeded(evt){
        if(callBackEvt.TransferRqSucceeded)
            callBackEvt.TransferRqSucceeded(this, evt);
    }

    function evtTransferRqFailed(evt){
        if(callBackEvt.TransferRqFailed)
            callBackEvt.TransferRqFailed(this, evt);
    }

    function evtTransferProgress(evt){
        if(callBackEvt.TransferProgress)
            callBackEvt.TransferProgress(this, evt);
    }

    function evtTransferAccepted(evt){
        if(callBackEvt.TransferAccepted)
            callBackEvt.TransferAccepted(this, evt);
    }

    function evtTransferFailed(evt){
        if(callBackEvt.TransferFailed)
            callBackEvt.TransferFailed(this, evt);
    }

    function SessionTrackStop(sess){
        function stopTrack(sender){
            if(sender.track && sender.track.kind){
                if(sender.track.kind.toLowerCase() == "audio"){
                    sender.track.stop();
                }
            }
            else{
                stream.getTracks().forEach(function(track){
                    if(track.kind.toLowerCase() == "audio"){
                        sender.track.stop();
                    }
                });
            }
        }

        var pc = sess.connection;
        if(pc.getTransceivers){         // Chrome M69 above
            pc.getTransceivers().forEach(function(tc){
                stopTrack(tc.sender);
            });
        }
        else{
            pc.getSenders().forEach(function(sender){
                stopTrack(sender);
            });
        }

    }

    function changeInput(sess, stream){
        function replaceTrack(sender){
            if(sender.track && sender.track.kind){
                if(sender.track.kind.toLowerCase() == "audio"){
                    sender.track.stop();
                    var ctrack=stream.getAudioTracks()[0].clone();      // 2021.03.25 yschang
                    sender.replaceTrack(ctrack);
                }
            }
            else{
                stream.getTracks().forEach(function(track){
                    if(track.kind.toLowerCase() == "audio"){
                        sender.track.stop();
                        var ctrack=stream.getAudioTracks()[0].clone();   // 2021.03.25 yschang
                        sender.replaceTrack(ctrack);
                    }
                });
            }
        }

        var pc = sess.connection;
        if(pc.getTransceivers){         // Chrome M69 above
            pc.getTransceivers().forEach(function(tc){
                replaceTrack(tc.sender);
            });
        }
        else{
            pc.getSenders().forEach(function(sender){
                replaceTrack(sender);
            });
        }
    }

    function elevateSession(){
        if(consultSession.direction === "incoming"){
            s1hold = s2hold;
            inSession = consultSession;
            inSession._data.isConsult = false;
            if(callBackEvt.ConsultSessionElevated)
                callBackEvt.ConsultSessionElevated(0);
        }
        else{
            s1hold = s2hold;
            outSession = consultSession;
            outSession._data.isConsult = false;
            if(callBackEvt.ConsultSessionElevated)
                callBackEvt.ConsultSessionElevated(1);
        }
        mobc1_state = mobc2_state;
        mobc2_state = undefined;
        s2hold = false;
        consultSession = undefined;
        if(!justSip){
            audioElement.srcObject = audconElement.srcObject;
            audioElement.play().catch(function(e) {console.log("[elevateSession] audioElement.play exception: ", e)});
            audconElement.load();
        }
    }

    function playSession(session, e){
        if(session._data.isConsult){
            audconElement.srcObject = e.streams[0];
            audconElement.play().catch(function(e) {console.log("[playSession] audconElement.play exception: ", e)});
        }
        else{
            audioElement.srcObject = e.streams[0];
            audioElement.play().catch(function(e) {console.log("[playSession] audioElement.play exception: ", e)});
        }
    }

    function CheckCallSideTone(){
        if(justSip)
            return;
            
        var muted, enable;
        [inSession, outSession, consultSession].forEach(function(item, i, arr){
            if(item){
                muted = item.isMuted();
                if(!muted.audio){
                    aduioSideTone.muted = false;
                    enable = 1;
                    return;
                }
            }
        });
        if(enable)
            return;
        aduioSideTone.muted = true;
    }

    function notijson(s){
//      return JSON.stringify(s, null, '\t');

        var next;
        var str = "{\n";

        function append(name, value){
            if(next)
                str += ",\n";
            str += "  \"" + name + "\" : " + "\""+ value + "\"";
            next = 1;
        }

        if(s.event)         append("event", s.event);
        if(s.result)        append("result", s.result);
        if(s.deviceid)      append("deviceid", s.deviceid);
        if(s.devicetext)    append("devicetext", s.devicetext);

        str += "\n}";
        
        return  str;
    }

    function slogwrite(txt){
        if(logFunc)
            logFunc("** " + txt);
    }

    
})((this.websip = {}));    // end of (function (myvar)
