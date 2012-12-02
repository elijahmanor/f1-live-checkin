// chrome.tabs.executeScript(null, { file: "fellowshipone.js" }, function() {
//   console.log( "fellowshipone is loaded" );
// });

chrome.extension.onMessage.addListener(function(request, sender, sendResponse) {
	//debugger;
	console.log(sender.tab ?
		"from a content script:" + sender.tab.url :
		"from the extension");
	if (request.action == "playSound") {
		playSound(request.message);
		sendResponse({farewell: "goodbye"});
	}
});

function playSound(message) {
	var url = "http://translate.google.com/translate_tts?tl=en&q=" + message;
	var audio = new Audio(url);
	audio.autoplay = true;
}
