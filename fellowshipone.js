/*jshint eqeqeq:true, strict:true */
/*globals jQuery:false, console:false, toastr:false, chrome:false, Gauge:false, JustGage:false */

/*
 * windows users
 * - keyop / F1.checkin
 * - command.central / Purple56&
 *
 * fellowshipone user
 * - keyop / F1.checkin / fbctn
 *
 * Feature Enhancments
 * - Make max participants based on ratio, then manual max, then override
 * - Refactor code
 * BUGS
 * - When class is closed & close it, it says it is full again
 * - Better system refresh when multiple full classes & change max
 * - Changing a max number sometimes refreshes too soon & says full
 */

(function ( kiosk, $, undefined ) {
	"use strict";

	var rate = window.localStorage[ "checkinRate" ];

	kiosk.updateFrequency = 10000;
	kiosk.timers = [];
	$( "tr" ).data( "updateFlag", true );
	// kiosk.updateFlag = true;
	kiosk.checkinRate = ( rate ? JSON.parse( rate ) : undefined ) || { status: "stopped", stats: [ { total: 0, rate: 0 } ] };

	kiosk.init = function() {
		kiosk.clearTimeout();

		kiosk.rearrange();
		kiosk.checkinRateRender = function() {
			var stat = kiosk.checkinRate.stats[ kiosk.checkinRate.stats.length - 1 ];

			$( "#checkinRateValue" ).text( stat.rate );
			kiosk.guage.current.refresh( stat.rate );
			kiosk.guage.total.refresh( Math.floor( stat.total ) );
		};

		kiosk.checkinRateUpdate = (function update() {
			var checkinRateUpdate = function() {
				var total = parseInt( $( ".table tr:last td:nth-child(3)" ).text(), 10 ),
					lastCheckInRate = kiosk.checkinRate.stats[ kiosk.checkinRate.stats.length - 1 ],
					rate = lastCheckInRate.total ? total - lastCheckInRate.total : 0,
					average = 0;

				if ( kiosk.checkinRate.status === "checking" ) {
					kiosk.checkinRate.stats.push({ total: total, rate: rate });
					window.localStorage[ "checkinRate" ] = JSON.stringify( kiosk.checkinRate );
				}
				kiosk.checkinRateRender();
				update();
			};

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
				// kiosk.updateFlag = false;
				$( "tr" ).data( "updateFlag", false );

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
		jQuery( "form .grid").removeClass( "grid" ).addClass( "table table-bordered table-condensed" );
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
			.after('<div class="stats" style="float:right; width: 35%;"><div class="hero-unit" style="padding: 15px;"><div><div><div id="gaugeCheckinRate" style="width:300px; height:170px"></div><div id="gaugeCheckinTotal" style="width:300px; height:170px"></div></div></div></div></div>');
		kiosk.initGuage();

		jQuery( "#header_search" ).val( "" );
	};

	kiosk.hijackOpenClosed = function() {
		jQuery( "a[href^='currentcheckin.aspx?actdetid=']" ).on( "click", function( e ) {
			var href = $( this ).attr( "href" ),
				$icon = $( this ).find( "i" );

			jQuery.ajax({
				type: "POST",
				accepts: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
				contentType: "application/x-www-form-urlencoded",
				url: href,
				data: jQuery( "#aspnetForm" ).serialize(),
				beforeSend: function( xhr ) {
					$icon.addClass( "icon-refresh-animate" );
					xhr.setRequestHeader( "X-Requested-With", { toString: function() { return ""; } } );
				},
				success: function( data ) {
					var $data = $( data ),
						found = $data.find( "a[href^='" + href.substr( 0, href.indexOf( "&amp;" ) ) +  "']" ).length;

					toastr.success( "" );
					kiosk.getCounts();
				},
				error: function( data ) {
					// toastr.error( "Error" );
					console.error( "Error" );
				},
				complete: function() {
					$icon.removeClass( "icon-refresh-animate" );
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

		kiosk.mergeColumns( $participants.index(), "participants" );
		kiosk.mergeColumns( $staff.index(), "staff" );

		jQuery( ".table td:nth-child(1) a" ).remove();
	};

	kiosk.removeColumn = function( text ) {
		var index = jQuery( ".table th:contains('" + text + "')" ).index() + 1;

		jQuery( ".table th:nth-child(" + index + "), .table td:nth-child(" + index + ")" ).remove();
	};

	kiosk.mergeColumns = function( index, type ) {
		index += 1;
		jQuery( ".table td:nth-child(" + index + ")" ).each( function() {
			var $this = $( this ),
				$show = $this.next().find( "a" ),
				$row = $this.closest( "tr" ),
				$badge;

			if ( $row.index() !== $row.siblings().length ) {
				$this.html( function( index, html ) {
					return $.trim( html ) ?
						"<a href='" + $show.attr( "href" ) + "'><span class='badge badge-success'>" + html + "</span></a>" :
						'<a href="#"><span class="badge badge-success">0</span></a>';
				});
				if ( type === "staff" ) {
					$badge = $this.find( ".badge" );
					kiosk.updateBadge( $badge, null, null, type );
				}
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
			$( this ).closest( "tr" ).data( "updateFlag", true );
			// kiosk.updateFlag = true;
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

	kiosk.updateCounts = function( title, counts, type ) {
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
			$sparkline.sparkline( sparkCounts, { /* height: "15px", */ width: "100px" } );

			if ( $badge.text() !== counts[ countIndex ] || $badge.closest( "tr" ).data( "updateFlag" ) ) {
				$badge.text( counts[ countIndex ] )
					.effect( "pulsate", { times: 3 }, 500 );
				kiosk.updateBadge( $badge, currentCount, maxCount, type );
			}
			countIndex++;
		});
	};

	kiosk.updateBadge = function( $badge, currentCount, maximumCount, type, data ) {
		var classes = "badge-important badge-success badge-warning badge-inverse",
			rowClasses = "success error warning info closed",
			$row = $badge.closest( "tr" ),
			isClosed = $row.css( "text-decoration" ) === "line-through";

		if ( type === "participants" ) {
			if ( currentCount >= maximumCount ) {
				$badge.removeClass( classes ).addClass( "badge-important" );
				$row.removeClass( rowClasses ).addClass( "error" );
				if ( !isClosed ) {
					kiosk.playSound( $.trim( $row.find( "td:nth-child(2)" ).text() ) );
				}
			} else if ( maximumCount - currentCount <= 2 ) {
				$badge.removeClass( classes ).addClass( "badge-warning" );
				$row.removeClass( rowClasses ).addClass( "warning" );
			} else if ( currentCount <= maximumCount && !isClosed ) {
				$badge.removeClass( classes ).addClass( "badge-success" );
				$row.removeClass( rowClasses );
			} else if ( isClosed ) {
				$badge.removeClass( classes );
				$row.removeClass( rowClasses ).addClass( "closed" );
			}
		} else if ( type === "staff" && data == null ) {
			var href = $badge.closest( "td" ).prev().find( "a" ).attr( "href" );
			if ( href ) {
				href = href.replace( "part", "stf" );
				$badge.closest( "td" ).find( "a ").attr( "href", href ).trigger( "click" );
			}
			kiosk.updateStaffBadge( $badge, null, null );
		} else if ( type === "staff" && data ) {
			kiosk.updateStaffBadge( $badge, data.match( /adult/ig ) || [], data.match( /student/ig ) || [] );
		}
	};

	kiosk.updateStaffBadge = function( $badge, adults, students ) {
		// Warning on staff ( 0, 1 adult, 1 student, all students/no adults )
		var classes = "badge-important badge-success badge-warning badge-inverse";

		if ( !adults && !students ) {
			if ( parseInt( $badge.text(), 0 ) < 2 ) {
				$badge.removeClass( classes ).addClass( "badge-important" ).attr( "title", "Warning. Staff is < 2. Don't accept participants. Getting more information..." );
			}
		} else if ( adults.length + students.length === 0 ) {
			$badge.removeClass( classes ).addClass( "badge-important" ).attr( "title", "Warning. No Staff. Don't accept participants." );
		} else if ( adults.length === 1 && !students.length ) {
			$badge.removeClass( classes ).addClass( "badge-important" ).attr( "title", "Warning. Only 1 adult and no students. Don't accept participants." );
		} else if ( !adults.length && students.length ) {
			$badge.removeClass( classes ).addClass( "badge-important" ).attr( "title", "Warning. Only students and no adults. Don't accept participants." );
		} else {
			$badge.removeClass( classes ).addClass( "badge-success" ).attr( "title", "The minimum staff requirements are met to accept participants." );
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
				var $data = $( data ), participants = [], staff = [], status = [];
				kiosk.removeRows( $data );

				$data.find( ".grid td:nth-child(" + ( $data.find( ".grid th:contains('Participant Count')").index() + 1 ) + ")" ).each(function() {
					participants.push( $( this ).text() || "0" );
				});
				kiosk.updateCounts( "Participants", participants, "participants" );

				$data.find( ".grid td:nth-child(" + ( $data.find( ".grid th:contains('Staff Count')").index() + 1 ) + ")" ).each(function() {
					staff.push( $( this ).text() || "0" );
				});
				kiosk.updateCounts( "Staff", staff, "staff" );

				$data.find( ".grid td:nth-child(3)" ).each(function() {
					status.push( $( this ).html() );
				});
				kiosk.updateStatus( status );
			},
			error: function( data ) {
				// toastroastr.error( data, "Error" );
				console.error( data, "Error" );
			},
			complete: function() {
				if ( callback ) { callback(); }
			}
		});
	};

	kiosk.hijackParticipant = function() {
		jQuery( document ).on( "click", function() {
			jQuery( "a[href*='currentcheckin.aspx?part=']" ).popover( "hide" );
		});
		jQuery( "a[href*='currentcheckin.aspx?part=']" ).on( "click", function( e ) {
			var that = this;
			e.preventDefault();
			e.stopImmediatePropagation();
			kiosk.getParticipants.call( this, function( markup ) {
				var popover = $( that ).data( "popover" );
				popover.options.content = markup || "None";
				$( that ).popover( "show" );
			});
		}).popover({ title: "Participants", content: "Place Holder" });
	};

	kiosk.hijackStaff = function() {
		jQuery( document ).on( "click", function() {
			jQuery( "a[href*='currentcheckin.aspx?stf=']" ).popover( "hide" );
		});
		jQuery( "a[href*='currentcheckin.aspx?stf=']" ).on( "click", function( e ) {
			var that = this;
			e.preventDefault();
			e.stopImmediatePropagation();
			kiosk.getParticipants.call( this, function( markup, raw ) {
				var popover = $( that ).data( "popover" ),
					expression = /<a href="[^<>]+">[^<>]+<\/a><br>[^<>]+<br>/g,
					matches = raw.match( expression );

				kiosk.updateBadge( $( that ).find( ".badge" ), null, null, "staff", matches ? matches.join( "" ) : markup );
				popover.options.content = matches ? matches.join( "" ) : markup;
				if ( e.originalEvent ) {
					$( that ).popover( "show" );
				}
			});
		}).popover({ title: "Staff", content: "Place Holder", placement: "left" });
	};

	kiosk.playSound = function(message) {
		message = message.substr(0, message.indexOf("-"));
		chrome.extension.sendMessage({action: "playSound", message: message + " is full"}, function(response) {
			toastr.error( message + " is full" );
		});
	};

	kiosk.getParticipants = function( callback ) {
		var $this = $( this ),
			href = $this.attr( "href" );

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

				callback.call( this, filtered, content );
			},
			error: function( data ) {
				// toastr.error( "Error" );
				console.error( "Error" );
			}
		});
	};

	kiosk.initGuage = function() {
		kiosk.guage = {};

		if ( jQuery( "#gaugeCheckinRate, #gaugeCheckinTotal" ).length === 2 ) {
			kiosk.guage.current = new JustGage({
				id: "gaugeCheckinRate",
				value: 0,
				min: 0,
				max: 30,
				title: "Current Check-ins",
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
		}
	};

	kiosk.insertSparklinks = function() {
		var $locations = $( ".table th:contains('Locations')" );

		$( ".table td:nth-child(" + ( $locations.index() + 1 ) + ")" ).each(function() {
			var $this = $( this );

			if ( !$this.is( ":contains('TOTAL')" ) ) {
				$this.html(function( index, html ) {
					return html + '<span class="sparklines" style="float: right; padding-right: 100px;"></span>';
				}).find( ".sparklines" ).data( "counts", [] ).sparkline({ /* height: "15px", */ width: "100px" });
			}
		});
	};

})( window.kiosk = window.kiosk || {}, jQuery );

if ( ~window.location.href.indexOf( "https://portal.fellowshipone.com/ministry/checkin/currentcheckin.aspx" ) ) {
	kiosk.init();
}
