/*jshint eqeqeq:true, strict:true */
/*globals jQuery:false, console:false, toastr:false, chrome:false, Gauge:false, JustGage:false */

/* TODO
 * - Clean up the Staff dialog
 * - Refactor code
 * - Make Staff error when 0 and warning when 1, green when 3+
 * - Show if participant is adult or child
 */

(function ( kiosk, $, undefined ) {
	"use strict";

	var rate = window.localStorage[ "checkinRate" ];
	kiosk.updateFrequency = 10000;
	kiosk.timers = [];
	kiosk.updateFlag = true;
	kiosk.checkinRate = ( rate ? JSON.parse( rate ) : undefined ) || { status: "stopped", stats: [ { total: 0, rate: 0 } ] };

	kiosk.init = function() {
		kiosk.clearTimeout();

		kiosk.rearrange();
		kiosk.checkinRateRender = function() {
			var stat = kiosk.checkinRate.stats[ kiosk.checkinRate.stats.length - 1 ],
				average = 0;

			kiosk.checkinRate.stats.forEach( function( item ) {
				average += item.rate;
			});
			average = average / kiosk.checkinRate.stats.length;

			$( "#checkinRateValue" ).text( stat.rate );
			kiosk.guage.current.refresh( stat.rate );
			kiosk.guage.average.refresh( Math.floor( average ) );
			kiosk.guage.total.refresh( Math.floor( stat.total ) );
			jQuery( "#debug" ).show().css( "padding" , "15px" ).html( JSON.stringify( kiosk.checkinRate ) );
		};
		kiosk.checkinRateUpdate = (function update() {
			var checkinRateUpdate = function() {
				var total = parseInt( $( ".table tr:last td:nth-child(3)" ).text(), 10 ),
					lastCheckInRate = kiosk.checkinRate.stats[ kiosk.checkinRate.stats.length - 1 ],
					// rate = Math.floor( Math.random() * 31 ),
					rate = lastCheckInRate.total ? total - lastCheckInRate.total : 0,
					average = 0;

				if ( kiosk.checkinRate.status === "checking" ) {
					console.log({ total: total, rate: rate });
					kiosk.checkinRate.stats.push({ total: total, rate: rate });
					window.localStorage[ "checkinRate" ] = JSON.stringify( kiosk.checkinRate );
				}
				kiosk.checkinRateRender();
				update();
			};

			// window.setTimeout( checkinRateUpdate, 15000 );
			window.setTimeout( checkinRateUpdate, 60000 );

			return checkinRateUpdate;
		}());
		kiosk.checkinRateRender();

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
		jQuery( "form .grid").removeClass( "grid" ).addClass( "table table-bordered table-condensed" ); // table-striped  table-hover
		kiosk.rearrangeColumns();
		kiosk.removeColumn( "Open" );
		kiosk.removeColumn( "Area" );
		jQuery( ".table th:nth-child(3), .table td:nth-child(3)" ).css( "text-align", "center" );
		jQuery( ".table th:nth-child(4), .table td:nth-child(4)" ).css( "text-align", "center" );
		kiosk.insertSparklinks();
		kiosk.insertMaxParticipants();
		kiosk.moveMinistrySelector();
		kiosk.updateOpenClosed();
		kiosk.updateLiveCheckInHeader();
		kiosk.tweakCurrentCheckInSelector();
		kiosk.hijackParticipant();
		kiosk.hijackStaff();
		kiosk.hijackOpenClosed();

		jQuery( "<style type='text/css'>.closed { background-color: #e8e8e8; } </style>" ).appendTo( "head" );

		jQuery("form .table").css({ float: "left", width: "60%"})
			.after('<div class="stats" style="float:right; width: 35%;"><div class="hero-unit" style="padding: 15px;"><div><div><div id="gaugeCheckinRate" style="width:300px; height:175px"></div><div id="gaugeCheckinAverage" style="width:300px; height:175px"></div><div id="gaugeCheckinTotal" style="width:300px; height:175px"></div><div style="text-align: right;"><button id="startCheckinRate" style="margin-right: 5px;" class="btn btn-primary" type="button">Start</button><button id="resetCheckinRate" style="margin-right: 5px;" class="btn">Reset</button><button id="stopCheckinRate" type="button" style="margin-right: 5px;" class="btn btn-danger" type="button">Stop</button></div></div></div></div><div style="display: none;" class="hero-unit" id="debug"></div></div>');
		kiosk.initGuage();

		jQuery( "#header_search" ).val( "" );
	};

	kiosk.hijackOpenClosed = function() {
		jQuery( "a[href^='currentcheckin.aspx?actdetid=']" ).on( "click", function( e ) {
			var href = $( this ).attr( "href" );

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
						found = $data.find( "a[href^='" + href.substr( 0, href.indexOf( "&amp;" ) ) +  "']" ).length;

					console.log( "found: " + found );
					kiosk.getCounts();
				},
				error: function( data ) {
					console.log( data, "error" );
					toastr.error( "Error" );
				}
			});
			e.preventDefault();
		});
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
		jQuery( ".table a[href$='&oc=1']" ).html( '<i class="icon-remove"></i>' ).closest( "tr" ).css( "text-decoration", "line-through" );
		jQuery( ".table a[href$='&oc=0']" ).html( '<i class="icon-ok"></i>' ).closest( "tr" ).css( "text-decoration", "none" );
	};

	kiosk.moveMinistrySelector = function() {
		jQuery( "#active_ministry_name" ).replaceWith( "<span id='active_ministry_name'>" + jQuery( "#active_ministry_name" ).html() + "</span>" );
		jQuery( "#breadcrumb" ).text( function( index, text ) { return text + " > "; } );
		jQuery( "#ministry_selection td" ).contents().appendTo( "#breadcrumb" );
		jQuery( "#breadcrumb" ).prependTo( "#aspnetForm" );
		// jQuery( "form .table_16:first" ).remove();
		jQuery( ".grid_16:first" ).remove();
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
	};

	kiosk.rearrangeColumns = function( index ) {
		var $participants = $( ".table th:contains('Participant Count')" ).html( "Participants" ),
			$staff = $( ".table th:contains('Staff Count')" ).html( "Staff" );

		kiosk.mergeColumns( $participants.index() );
		kiosk.mergeColumns( $staff.index() );

		jQuery( ".table td:nth-child(1) a" ).remove();
	};

	kiosk.removeColumn = function( text ) {
		var index = jQuery( ".table th:contains('" + text + "')" ).index() + 1;

		jQuery( ".table th:nth-child(" + index + "), .table td:nth-child(" + index + ")" ).remove();
	};

	kiosk.mergeColumns = function( index ) {
		index += 1;
		jQuery( ".table td:nth-child(" + index + ")" ).each( function() {
			var $this = $( this ),
				$show = $this.next().find( "a" ),
				$row = $this.closest( "tr" );

			// TODO: highlight row
			if ( $row.index() !== $row.siblings().length ) {
				$this.html( function( index, html ) {
					return $.trim( html ) ? "<a href='" + $show.attr( "href" ) + "'><span class='badge badge-success'>" + html + "</span></a>" : '<a href="#"><span class="badge badge-success">0</span></a>';
				});
			}
		});
		index += 1;
		jQuery( ".table th:nth-child(" + index + "), .table td:nth-child(" + index + ")" ).remove();
	};

	kiosk.insertMaxParticipants = function() {
		var $participants = $( ".table th:contains('Participants')" );

		$( ".table td:nth-child(" + ( $participants.index() + 1 ) + ")" ).each(function() {
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
		var columnIndex = $( ".table th:contains('" + title + "')" ).index(),
			countIndex = 0;

		$( ".table td:nth-child(" + ( columnIndex + 1 ) + ")" ).each(function() {
			var $badge = $( this ).find( "a .badge" ),
				currentCount = parseInt( counts[ countIndex ], 10 ),
				maxCount = parseInt( $badge.closest( "td" ).find( ".participant-max" ).text(), 10 ),
				$sparkline = $( this ).prev().find( ".sparklines" ),
				sparkCounts = $sparkline.data( "counts" ) || [];

			$badge = $badge.length ? $badge : $( this );

			sparkCounts.push( counts[ countIndex ] );
			$sparkline.data( "counts", sparkCounts );
			$sparkline.sparkline( sparkCounts, { width: "100px" } );

			if ( $badge.text() !== counts[ countIndex ] || kiosk.updateFlag ) {
				$badge.text( counts[ countIndex ] ) //.end()
					//.effect( "highlight", {}, 6000 );
					.effect( "pulsate", { times: 3 }, 500 );
				kiosk.updateBadge( $badge, currentCount, maxCount );
				// .effect( "pulsate", { times: 3 }, 500 );
			}
			countIndex++;
		});
	};

	kiosk.updateBadge = function( $badge, currentCount, maximumCount ) {
		var classes = "badge-important badge-success badge-warning badge-inverse",
			rowClasses = "success error warning info closed",
			$row = $badge.closest( "tr" );

		if ( $badge.closest( "tr" ).css( "text-decoration" ) === "line-through" ) {
			$badge.removeClass( classes ); //.addClass( "badge-inverse" );
			$row.removeClass( rowClasses ).addClass( "closed" );
		} else {
			if ( currentCount >= maximumCount ) {
				$badge.removeClass( classes ).addClass( "badge-important" );
				$row.removeClass( rowClasses ).addClass( "error" );
				kiosk.playSound($.trim($badge.closest("tr").find("td:nth-child(2)").text()));
			} else if ( maximumCount - currentCount <= 2 ) {
				$badge.removeClass( classes ).addClass( "badge-warning" );
				$row.removeClass( rowClasses ).addClass( "warning" );
			} else if ( currentCount <= maximumCount ) {
				$badge.removeClass( classes ).addClass( "badge-success" );
				$row.removeClass( rowClasses );
			}
		}
	};

	kiosk.updateStatus = function( status ) {
		var index = 0;

		$( ".table td:nth-child(1)" ).each(function() {
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
		jQuery( "#resetCheckinRate" ).on( "click", function( e ) {
			kiosk.checkinRate = { status: kiosk.checkinRate.status, stats: [ { total: 0, rate: 0 } ] };
			window.localStorage[ "checkinRate" ] = JSON.stringify( kiosk.checkinRate );
			kiosk.checkinRateRender();
			e.preventDefault();
		});
		jQuery( "#startCheckinRate" ).on( "click", function( e ) {
			kiosk.checkinRate.status = "checking";
			window.localStorage[ "checkinRate" ] = JSON.stringify( kiosk.checkinRate );
			kiosk.checkinRateRender();
			e.preventDefault();
		});
		jQuery( "#stopCheckinRate" ).on( "click", function( e ) {
			kiosk.checkinRate.status = "stopped";
			window.localStorage[ "checkinRate" ] = JSON.stringify( kiosk.checkinRate );
			kiosk.checkinRateRender();
			e.preventDefault();
		});

		kiosk.guage = {};

		kiosk.guage.current = new JustGage({
			id: "gaugeCheckinRate",
			value: 0,
			min: 0,
			max: 30,
			title: "Current Check-ins",
			label: "per minute"
		});

		kiosk.guage.average = new JustGage({
			id: "gaugeCheckinAverage",
			value: 0,
			min: 0,
			max: 30,
			title: "Average Check-ins",
			label: "per minute"
		});

		kiosk.guage.total = new JustGage({
			id: "gaugeCheckinTotal",
			value: 0,
			min: 0,
			max: 500,
			title: "Total Check-ins",
			label: ""
		});
	};

	kiosk.insertSparklinks = function() {
		var $locations = $( ".table th:contains('Locations')" );

		$( ".table td:nth-child(" + ( $locations.index() + 1 ) + ")" ).each(function() {
			var $this = $( this );

			if ( !$this.is( ":contains('TOTAL')" ) ) {
				$this.html(function( index, html ) {
					return html + '<span class="sparklines" style="float: right; padding-right: 100px;"></span>';
				}).find( ".sparklines" ).data( "counts", [] ).sparkline({ width: "100px" });
			}
		});
	};

})( window.kiosk = window.kiosk || {}, jQuery );

if ( ~window.location.href.indexOf( "https://portal.fellowshipone.com/ministry/checkin/currentcheckin.aspx" ) ) {
	kiosk.init();
}
