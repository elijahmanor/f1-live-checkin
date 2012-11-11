/*jshint eqeqeq:true, strict:true */
/*globals jQuery:false, console:false, toastr:false, chrome:false, Gauge:false */

/* TODO
 * - Clean up the Staff dialog
 * - Making Open/Close class use AJAX instead of post-back
 * - Make stats section on the right
 * - Refactor code
 * - Play sound when max has been reached
 * - http://omnipotent.net/jquery.sparkline/#syntax
 * - Make Staff error when 0 and warning when 1, green when 3+
 */

(function ( kiosk, $, undefined ) {
	"use strict";

	kiosk.updateFrequency = 10000;
	kiosk.timers = [];
	kiosk.updateFlag = true;

	kiosk.init = function() {
		kiosk.clearTimeout();

		kiosk.rearrange();

		kiosk.startRefreshLoop();
	};

	kiosk.startRefreshLoop = function() {
		(function updateLoop() {
			$( "#refreshIcon" ).addClass( "icon-refresh-animate" );

			kiosk.getCounts(function() {
				kiosk.timers.push( window.setTimeout( updateLoop, kiosk.updateFrequency ) );

				var currentTimeout = kiosk.updateFrequency / 1000;
				$( "#updateStatus" ).html( currentTimeout + " seconds" );
				$( "#refreshIcon" ).removeClass( "icon-refresh-animate" );
				kiosk.updateFlag = false;

				window.setTimeout( function updateTimer() {
					currentTimeout--;
					$( "#updateStatus" ).html( currentTimeout + " seconds" );
					if ( currentTimeout ) {
						kiosk.timers.push( window.setTimeout( updateTimer, 1000 ) );
					}
				}, 1000 );
			});
		}());
	};

	kiosk.clearTimeout = function() {
		for ( var i = 0; i < 100000; i++ ) {
			window.clearTimeout( i );
		}
	};

	kiosk.rearrange = function() {
		kiosk.removeRows();
		kiosk.rearrangeColumns();
		kiosk.removeColumn( "Open" );
		kiosk.removeColumn( "Area" );
		kiosk.insertMaxParticipants();
		kiosk.moveMinistrySelector();
		kiosk.updateOpenClosed();
		kiosk.updateLiveCheckInHeader();
		kiosk.tweakCurrentCheckInSelector();
		kiosk.hijackParticipant();
		kiosk.hijackStaff();

		jQuery("form .grid").css({ float: "left", width: "52%"})
			.after('<div class="stats" style="float:right; width: 45%;"><div class="hero-unit"><div><h1>Check-ins per Minute</h1><div><h4 style="font-size: 2em; text-align: center;">23</h4><canvas id="checkinRate" style="width: 100%; height: 150px; position: relative;"></canvas></div></div></div></div>');
		kiosk.initGuage();

		jQuery( "#header_search" ).val( "" );
	};

	kiosk.tweakCurrentCheckInSelector = function() {
		jQuery( "table.form th" ).css( "font-size", "19px" );
		jQuery( "[name='activeCheckinDropDown']" ).css( "width", "325px" );
	};

	kiosk.updateLiveCheckInHeader = function() {
		jQuery( ".float_left:contains('Live Check-ins')" ).empty().removeClass( "float_left" ).append( '<span style="float: left;">Live Check-ins</span><span style="float: right;"><span id="updateStatus" style="color: #777777;">0 seconds</span> <a id="updateCounts" href="#"><i id="refreshIcon" class="icon-refresh"></i></a></span>' );
		$( "#updateCounts" ).on( "click", function( e ) {
			$.each( kiosk.timers, function( index, timer ) {
				window.clearTimeout( timer );
			});
			kiosk.startRefreshLoop();
			e.preventDefault();
		});
	};

	kiosk.updateOpenClosed = function() {
		jQuery( ".grid a[href$='&oc=1']" ).html( '<i class="icon-remove"></i>' ).closest( "tr" ).css( "text-decoration", "line-through" );
		jQuery( ".grid a[href$='&oc=0']" ).html( '<i class="icon-ok"></i>' ).closest( "tr" ).css( "text-decoration", "none" );
	};

	kiosk.moveMinistrySelector = function() {
		jQuery( "#active_ministry_name" ).replaceWith( "<span id='active_ministry_name'>" + jQuery( "#active_ministry_name" ).html() + "</span>" );
		jQuery( "#breadcrumb" ).text( function( index, text ) { return text + " > "; } );
		jQuery( "#ministry_selection td" ).contents().appendTo( "#breadcrumb" );
		jQuery( "#breadcrumb" ).prependTo( "#aspnetForm" );
		jQuery( "form .grid_16:first" ).remove();
	};

	kiosk.removeRows = function( context ) {
		context = context || document;

		$( ".grid td:nth-child(1)", context ).each(function() {
			var $this = $( this ),
				text = $.trim( $this.text() );

			if ( ~text.indexOf( "Total for" ) || $( this ).attr( "colspan" ) === "8" ) {
				$this.closest( "tr" ).remove();
			}
		});

		$( ".grid tr" ).removeClass( "zebra" ).filter( ":odd" ).addClass( "zebra" );
	};

	kiosk.rearrangeColumns = function( index ) {
		var $participants = $( ".grid th:contains('Participant Count')" ).html( "Participants" ),
			$staff = $( ".grid th:contains('Staff Count')" ).html( "Staff" );

		kiosk.mergeColumns( $participants.index() );
		kiosk.mergeColumns( $staff.index() );

		jQuery( ".grid td:nth-child(1) a" ).remove();
	};

	kiosk.removeColumn = function( text ) {
		var index = jQuery( ".grid th:contains('" + text + "')" ).index() + 1;

		jQuery( ".grid th:nth-child(" + index + "), .grid td:nth-child(" + index + ")" ).remove();
	};

	kiosk.mergeColumns = function( index ) {
		index += 1;
		jQuery( ".grid td:nth-child(" + index + ")" ).each( function() {
			var $this = $( this ),
				$show = $this.next().find( "a" ),
				$row = $this.closest( "tr" );

			if ( $row.index() !== $row.siblings().length ) {
				$this.html( function( index, html ) {
					return $.trim( html ) ? "<a href='" + $show.attr( "href" ) + "'><span class='badge badge-success'>" + html + "</span></a>" : '<a href="#"><span class="badge badge-success">0</span></a>';
				});
			}
		});
		index += 1;
		jQuery( ".grid th:nth-child(" + index + "), .grid td:nth-child(" + index + ")" ).remove();
	};

	kiosk.insertMaxParticipants = function() {
		var $participants = $( ".grid th:contains('Participants')" );

		$( ".grid td:nth-child(" + ( $participants.index() + 1 ) + ")" ).each(function() {
			var $this = $( this ),
				$row = $this.closest( "tr" );

			if ( $row.index() !== $row.siblings().length ) {
				$( this ).html(function( index, html ) {
					html = $.trim( html ) || "0";
					return html + "<span> / </span><span class='badge participant-max' contenteditable='true'>0</span>";
				});
			}
		});

		$( ".participant-max" ).on( "blur", function() {
			kiosk.savePreferences();
			kiosk.updateFlag = true;
		});

		kiosk.restorePreferences();
	};

	kiosk.savePreferences = function() {
		$( ".participant-max" ).each( function( index, element ) {
			window.localStorage[ "preference." + index ] = $( this ).text();
		});
	};

	kiosk.restorePreferences = function() {
		$( ".participant-max" ).each( function( index, element ) {
			$( this ).text( window.localStorage[ "preference." + index ] );
		});
	};

	kiosk.updateCounts = function( title, counts ) {
		var columnIndex = $( ".grid th:contains('" + title + "')" ).index(),
			countIndex = 0;

		$( ".grid td:nth-child(" + ( columnIndex + 1 ) + ")" ).each(function() {
			var $badge = $( this ).find( "a .badge" ),
				currentCount = parseInt( counts[ countIndex ], 10 ),
				maxCount = parseInt( $badge.closest( "td" ).find( ".participant-max" ).text(), 10 );

			$badge = $badge.length ? $badge : $( this );
			if ( $badge.text() !== counts[ countIndex ] || kiosk.updateFlag ) { // TODO: Remove this comment...
				$badge.text( counts[ countIndex ] ).end().effect( "highlight", {}, 6000 );
				kiosk.updateBadge( $badge, currentCount, maxCount );
				// .effect( "pulsate", { times: 3 }, 500 );
			}
			countIndex++;
		});
	};

	kiosk.updateBadge = function( $badge, currentCount, maximumCount ) {
		var classes = "badge-important badge-success badge-warning badge-inverse";

		if ( $badge.closest( "tr" ).css( "text-decoration" ) === "line-through" ) {
			$badge.removeClass( classes ); //.addClass( "badge-inverse" );
		} else {
			if ( currentCount >= maximumCount ) {
				$badge.removeClass( classes ).addClass( "badge-important" );
				kiosk.playSound($.trim($badge.closest("tr").find("td:nth-child(2)").text()));
			} else if ( maximumCount - currentCount <= 2 ) {
				$badge.removeClass( classes ).addClass( "badge-warning" );
			} else if ( currentCount <= maximumCount ) {
				$badge.removeClass( classes ).addClass( "badge-success" );
			}
		}
	};

	kiosk.updateStatus = function( status ) {
		var index = 0;

		$( ".grid td:nth-child(1)" ).each(function() {
			var $anchor = $( this ).find( "a" );
			if ( ~status[ index ].indexOf( "oc=1" ) ) {
				$anchor.attr( "href", function( index, href ) {
					return href.replace( "oc=0", "oc=1" );
				}).find( "i" ).removeClass( "icon-ok" ).addClass( "icon-remove" );
			} else  {
				$anchor.attr( "href", function( index, href ) {
					return href.replace( "oc=1", "oc=0" );
				}).find( "i" ).removeClass( "icon-remove" ).addClass( "icon-ok" );
			}
			index++;
		});

		kiosk.updateOpenClosed();
	};

	kiosk.getCounts = function( callback ) {
		jQuery.ajax({
			type: "POST",
			accepts: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
			contentType: "application/x-www-form-urlencoded",
			url: jQuery( "#aspnetForm" ).attr( "action" ),
			data: jQuery( "#aspnetForm" ).serialize(),
			beforeSend: function( xhr ) {
				xhr.setRequestHeader( "X-Requested-With", { toString: function() { return ""; } } );
			},
			success: function( data ) {
				//toastr.warning( "My name is Inigo Montoya. You Killed my father, prepare to die!" );
				var $data = $( data ), participants = [], staff = [], status = [];
				kiosk.removeRows( $data );

				$data.find( ".grid td:nth-child(" + ( $data.find( ".grid th:contains('Participant Count')").index() + 1 ) + ")" ).each(function() {
					participants.push( $( this ).text() || "0" );
				});
				kiosk.updateCounts( "Participants", participants );

				$data.find( ".grid td:nth-child(" + ( $data.find( ".grid th:contains('Staff Count')").index() + 1 ) + ")" ).each(function() {
					staff.push( $( this ).text() || "0" );
				});
				kiosk.updateCounts( "Staff", staff );

				$data.find( ".grid td:nth-child(3)" ).each(function() {
					status.push( $( this ).html() );
				});
				kiosk.updateStatus( status );
				// toastr.success( "Data has been retrieved from the server" );
			},
			error: function( data ) {
				toastr.error( data, "Error" );
			},
			complete: function() {
				if ( callback ) { callback(); }
			}
		});
	};

	kiosk.hijackParticipant = function() {
		console.log( "hijackParticipant" );
		jQuery( document ).on( "click", function() {
			jQuery( "a[href*='currentcheckin.aspx?part=']" ).popover( "hide" );
		});
		jQuery( "a[href*='currentcheckin.aspx?part=']" ).on( "click", function( e ) {
			var that = this;
			console.log( "clicked participant" );
			e.preventDefault();
			e.stopImmediatePropagation();
			kiosk.getParticipants.call( this, function( markup ) {
				var popover = $( that ).data( "popover" );
				popover.options.content = markup || "None"; // + "<br/>" + (new Date()).getTime();
				$( that ).popover( "show" );
			});
		}).popover({ title: "Participants", content: "Place Holder" });
	};

	kiosk.hijackStaff = function() {
		console.log( "hijackStaff" );
		jQuery( document ).on( "click", function() {
			jQuery( "a[href*='currentcheckin.aspx?stf=']" ).popover( "hide" );
		});
		jQuery( "a[href*='currentcheckin.aspx?stf=']" ).on( "click", function( e ) {
			var that = this;
			console.log( "clicked staff" );
			e.preventDefault();
			e.stopImmediatePropagation();
			kiosk.getParticipants.call( this, function( markup ) {
				var popover = $( that ).data( "popover" );
				popover.options.content = markup; // + "<br/>" + (new Date()).getTime();
				$( that ).popover( "show" );
			});
		}).popover({ title: "Staff", content: "Place Holder", placement: "left" });
	};

	kiosk.playSound = function(message) {
		message = message.substr(0, message.indexOf("-"));
		chrome.extension.sendMessage({action: "playSound", message: message + " is full"}, function(response) {
			console.log(response.farewell);
		});
	};

	kiosk.getParticipants = function( callback ) {
		var $this = $( this ),
			href = $this.attr( "href" );

		console.log( "getParticipants" );
		jQuery.ajax({
			type: "POST",
			accepts: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
			contentType: "application/x-www-form-urlencoded",
			url: href,
			data: jQuery( "#aspnetForm" ).serialize(),
			beforeSend: function( xhr ) {
				xhr.setRequestHeader( "X-Requested-With", { toString: function() { return ""; } } );
			},
			success: function( data ) {
				var $data = $( data ),
					content = $data.find( "a[href='" + href.replace( /(.*aspx\?(part|stf)=)(\d*)(#\d*)/, "$10$4" ) +  "']" ).closest( "td" ).html(),
					filtered = $( "<div>" ).html( $( content ).filter( ":not(:contains('Participants'))" ).filter( ":not(:contains('Workers'))" ).filter( ":not(:contains('Move'))" ).clone() ).html();

				console.log( "content: " + filtered );
				callback.call( this, filtered );
			},
			error: function( data ) {
				console.log( data, "error" );
				toastr.error( "Error" );
			}
		});
	};

	kiosk.initGuage = function() {
		var opts = {
				lines: 12, // The number of lines to draw
				angle: 0.15, // The length of each line
				lineWidth: 0.39, // The line thickness
				pointer: {
				length: 0.92, // The radius of the inner circle
				strokeWidth: 0.035, // The rotation offset
				color: '#000000' // Fill color
			},
			colorStart: '#6FADCF',   // Colors
			colorStop: '#8FC0DA',    // just experiment with them
			strokeColor: '#E0E0E0',   // to see which ones work best for you
			generateGradient: true
		};

		var target = document.getElementById('checkinRate'); // your canvas element
		var gauge = new Gauge(target).setOptions(opts); // create sexy gauge!
		gauge.maxValue = 3000; // set max gauge value
		gauge.animationSpeed = 22; // set animation speed (32 is default value)
		gauge.set(1125); // set actual value
	};

/*

table table-striped <-- add classes (remove existing grid class)

<form class="form-horizontal">
  <div class="control-group">
    <label class="control-label" for="inputEmail">Email</label>
    <div class="controls">
      <input type="text" id="inputEmail" placeholder="Email">
    </div>
  </div>
  <div class="control-group">
    <label class="control-label" for="inputPassword">Password</label>
    <div class="controls">
      <input type="password" id="inputPassword" placeholder="Password">
    </div>
  </div>
  <div class="control-group">
    <div class="controls">
      <label class="checkbox">
        <input type="checkbox"> Remember me
      </label>
      <button type="submit" class="btn">Sign in</button>
    </div>
  </div>
</form>

rows
.success	Indicates a successful or positive action.
.error	Indicates a dangerous or potentially negative action.
.warning	Indicates a warning that might need attention.
.info

play sound
<audio src="elvis.ogg" controls preload="auto" autobuffer></audio>

*/

})( window.kiosk = window.kiosk || {}, jQuery );

if ( ~window.location.href.indexOf( "https://portal.fellowshipone.com/ministry/checkin/currentcheckin.aspx" ) ) {
	kiosk.init();
}
