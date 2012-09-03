/*jshint eqeqeq:true, strict:true */
/*globals jQuery:false, console:false */

(function ( kiosk, $, undefined ) {
	"use strict";

	kiosk.init = function() {
		kiosk.clearTimeout();

		kiosk.rearrange();

		// window.setTimeout( function() {
		// 	kiosk.getCounts();
		// }, 20000 );
	};

	kiosk.clearTimeout = function() {
		for ( var i = 0; i < 10000; i++ ) {
			window.clearTimeout( i );
		}
	};

	kiosk.rearrange = function() {
		kiosk.removeRows();
		kiosk.rearrangeColumns();
		kiosk.removeColumn( "Open" );
		kiosk.removeColumn( "Area" );
		kiosk.insertMaxParticipants();
	};

	kiosk.removeRows = function() {
		$( ".grid td:nth-child(1)" ).each(function() {
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
				console.log( "success", data );
			},
			error: function( data ) {
				console.log( "error", data );
			}
		});
	};

})( window.kiosk = window.kiosk || {}, jQuery );

kiosk.init();
