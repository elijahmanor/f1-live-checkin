/*jshint eqeqeq:true, strict:true */
/*globals jQuery:false, console:false, toastr:false */

(function ( kiosk, $, undefined ) {
	"use strict";

	kiosk.init = function() {
		kiosk.clearTimeout();

		kiosk.rearrange();

		(function updateLoop() {
			window.setTimeout(function() {
				kiosk.getCounts();
				window.setTimeout( updateLoop, 20000 );
			}, 20000 );
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
		kiosk.insertUpdateButton();
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

			if ( text === "" || ~text.indexOf( "Total for" ) ) {
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

	//<a href="currentcheckin.aspx?actdetid=994485&amp;oc=0">Close</a>
	//<a href="currentcheckin.aspx?actdetid=994461&amp;oc=1">Open</a>

	// <i class="icon-ok"></i>
	// <i class="icon-remove"></i>
	// <a class="btn btn-small" href="#"><i class="icon-refresh"></i></a>

	// <ul class="breadcrumb">
	//   <li><a href="#">Home</a> <span class="divider">/</span></li>
	//   <li><a href="#">Library</a> <span class="divider">/</span></li>
	//   <li class="active">Data</li>
	// </ul> 

	// Default	<span class="label">Default</span>
	// Success	<span class="label label-success">Success</span>
	// Warning	<span class="label label-warning">Warning</span>
	// Important	<span class="label label-important">Important</span>
	// Info	<span class="label label-info">Info</span>
	// Inverse	<span class="label label-inverse">Inverse</span>

	// 	<span class="badge">1</span>
	// Success	2	<span class="badge badge-success">2</span>
	// Warning	4	<span class="badge badge-warning">4</span>
	// Important	6	<span class="badge badge-important">6</span>
	// Info	8	<span class="badge badge-info">8</span>
	// Inverse	10	<span class="badge badge-inverse">10</span>


	kiosk.mergeColumns = function( index ) {
		index += 1;
		jQuery( ".grid td:nth-child(" + index + ")" ).each( function() {
			var $this = $( this ),
				$show = $this.next().find( "a" );

			$this.html( function( index, html ) {
				return $.trim( html ) ? "<a href='" + $show.attr( "href" ) + "'>" + html + "</a>" : "";
			});
		});
		index += 1;
		jQuery( ".grid th:nth-child(" + index + "), .grid td:nth-child(" + index + ")" ).remove();
	};

	kiosk.insertMaxParticipants = function() {
		var $participants = $( ".grid th:contains('Participants')" );

		$( ".grid td:nth-child(" + ( $participants.index() + 1 ) + ")" ).each(function() {
			$( this ).html(function( index, html ) {
				return $.trim( html ) ? html + "<span> / </span><span class='participant-max' contenteditable='true'>0</span>" : "";
			});
		});
	};

	kiosk.insertUpdateButton = function() {
		$( "<button />", {
			text: "Update",
			click: function( e ) {
				kiosk.getCounts();
				e.preventDefault();
			}
		}).appendTo( ".section .form tr" );
	};

	kiosk.updateCounts = function( title, counts ) {
		var columnIndex = $( ".grid th:contains('" + title + "')" ).index(),
			countIndex = 0;

		// counts[ 0 ] = Math.floor( Math.random() * 101 ) + "";
		$( ".grid td:nth-child(" + ( columnIndex + 1 ) + ")" ).each(function() {
			var $anchor = $( this ).find( "a" );
			if ( $anchor.text() !== counts[ countIndex ] ) {
				$anchor.text( counts[ countIndex ] ).effect( "pulsate", { times: 3 }, 500 );
			}
			countIndex++;
		});
	};

	kiosk.getCounts = function() {
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
				var $data = $( data ), participants = [], staff = [];
				kiosk.removeRows( $data );

				$data.find( ".grid td:nth-child(" + ( $data.find( ".grid th:contains('Participant Count')").index() + 1 ) + ")" ).each(function() {
					participants.push( $( this ).text() );
				});
				kiosk.updateCounts( "Participants", participants );

				$data.find( ".grid td:nth-child(" + ( $data.find( ".grid th:contains('Staff Count')").index() + 1 ) + ")" ).each(function() {
					staff.push( $( this ).text() );
				});
				kiosk.updateCounts( "Staff", staff );

				toastr.success( "Data has been retrieved from the server", "Success" );
				//toastr.info( "Found Participants: " + $( data ).find( ".grid th:contains('Participant Count')" ).length );
				//toastr.info( "Found Staff: " + $( data ).find( ".grid th:contains('Staff Count')" ).length );
			},
			error: function( data ) {
				toastr.error( data, "Error" );
			}
		});
	};

})( window.kiosk = window.kiosk || {}, jQuery );

if ( ~window.location.href.indexOf( "https://portal.fellowshipone.com/ministry/checkin/currentcheckin.aspx" ) ) {
	kiosk.init();
}
