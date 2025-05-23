
    function grmpad(n, width){
		n = n + '';
		return n.length >= width ? n : new Array(width - n.length + 1).join('0') + n;
    }

    function grmlogwrite(text){
		var log = document.getElementById("logarea");
		var date = new Date();
		log.value += "[" + grmpad(date.getHours(),2) +
					 ":" + grmpad(date.getMinutes(),2) +
					 ":" + grmpad(date.getSeconds(),2) +
					 "." + grmpad(date.getMilliseconds(),3) + "] ";
		log.value += text;
		log.value += "\n";
		log.scrollTop = log.scrollHeight;
    }

    function grmlogClear(){
		document.getElementById("logarea").value = null;
    }

	function grmlogSendError(){
		alert("fail");
	}

	function grmlogSendComplete(){
		alert("success");
	}

	function grmlogSend() {
		websip.dump();
		
        var date = new Date();
		var myNumber= document.getElementById("myNumber").value;
        var logstr 	= document.getElementById("logarea").value;
        var filename = grmpad(date.getFullYear(),4) + grmpad(date.getMonth()+1,2) + grmpad(date.getDate(),2)    + "_" +
					   grmpad(date.getHours(),2)    + grmpad(date.getMinutes(),2) + grmpad(date.getSeconds(),2) + "_" + myNumber + ".txt";
        var tmp = new File([logstr], filename, {type: "text/plain"});        

        var formData = new FormData();                         
        formData.append("file", tmp);
        
		var request = new XMLHttpRequest();
		request.onerror = grmlogSendError;
		request.onload = grmlogSendComplete;
        request.open("POST", "https://100.100.107.176:8100/upload");
        request.send(formData);
    }
