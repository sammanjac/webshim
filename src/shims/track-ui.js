jQuery.webshims.register('track-ui', function($, webshims, window, document, undefined){
	var options = webshims.cfg.track;
	var enterE = {type: 'enter'};
	var exitE = {type: 'exit'};
	var showTracks = {subtitles: 1, captions: 1};
	var usesNativeTrack =  function(){
		return !options.override && Modernizr.track;
	};
	
	var trackDisplay = {
		update: function(baseData, media){
			if(!baseData.activeCues.length){
				this.hide(baseData);
			} else {
				if(!this.compareArray(baseData.displayedActiveCues, baseData.activeCues)){
					baseData.displayedActiveCues = baseData.activeCues;
					if(!baseData.trackDisplay){
						baseData.trackDisplay = $('<div class="cue-display"></div>').insertAfter(media);
						this.addEvents(baseData, media);
					}
					
					if(baseData.hasDirtyTrackDisplay){
						media.triggerHandler('forceupdatetrackdisplay');
					}
					this.showCues(baseData);
				}
			}
		},
		showCues: function(baseData){
			var element = $('<span class="cue-wrapper" />');
			$.each(baseData.displayedActiveCues, function(i, cue){
				element.append(
					$('<span class="cue" />').html(cue.getCueAsHTML())
				);
			});
			baseData.trackDisplay.html(element);
		},
		compareArray: function(a1, a2){
			var ret = true;
			var i = 0;
			var len = a1.length;
			if(len != a2.length){
				ret = false;
			} else {
				for(; i < len; i++){
					if(a1[i] != a2[i]){
						ret = false;
						break;
					}
				}
			}
			return ret;
		},
		addEvents: function(baseData, media){
			if(options.positionDisplay){
				var timer;
				var positionDisplay = function(_force){
					if(baseData.displayedActiveCues.length || _force === true){
						baseData.trackDisplay.css({display: 'none'});
						var uiElement = media.getShadowElement();
						var offsetElement = uiElement.offsetParent();
						var uiHeight = uiElement.innerHeight();
						var uiWidth = uiElement.innerWidth();
						var position = uiElement.position();
						var displaySize = uiHeight * uiWidth;
						baseData.trackDisplay.css({
							left: position.left,
							width: uiWidth,
							height: uiHeight - 45,
							top: position.top,
							display: 'block'
						});
						
						baseData.trackDisplay.css('fontSize', Math.max(Math.round(uiHeight / 30), 7));
						baseData.hasDirtyTrackDisplay = false;
					} else {
						baseData.hasDirtyTrackDisplay = true;
					}
				};
				var delayed = function(e){
					clearTimeout(timer);
					timer = setTimeout(positionDisplay, (e && e.type == 'resize') ? 99 : 9);
				};
				var forceUpdate = function(){
					positionDisplay(true);
				};
				media.bind('playerdimensionchange mediaelementapichange updatetrackdisplay updatemediaelementdimensions swfstageresize', delayed);
				$(window).bind('resize emchange', delayed);
				media.bind('forceupdatetrackdisplay', forceUpdate);
				forceUpdate();
			}
		},
		hide: function(baseData){
			if(baseData.trackDisplay && baseData.displayedActiveCues.length){
				baseData.displayedActiveCues = [];
				baseData.trackDisplay.empty();
			}
		}
	};
	
	webshims.mediaelement.trackDisplay = trackDisplay;
	
	webshims.mediaelement.getActiveCue = function(track, media, time, baseData){
		if(!track._lastFoundCue){
			track._lastFoundCue = {index: 0, time: 0};
		}
		
		if(Modernizr.track && !track._shimActiveCues){
			track._shimActiveCues = [];
		}
		
		var i = 0;
		var len;
		var cue;
		
		for(; i < track.shimActiveCues.length; i++){
			cue = track.shimActiveCues[i];
			if(cue.startTime > time || cue.endTime < time){
				track.shimActiveCues.splice(i, 1);
				i--;
				if(cue.pauseOnExit){
					$(media).pause();
				}
				$(track).triggerHandler('cuechange');
				$(cue).triggerHandler('exit');
			} else if(track.mode > 1 && showTracks[track.kind] && $.inArray(cue, baseData.activeCues) == -1){
				baseData.activeCues.push(cue);
			}
		}
		

		len = track.cues.length;
		i = track._lastFoundCue.time < time ? track._lastFoundCue.index : 0;
		
		for(; i < len; i++){
			cue = track.cues[i];
			
			if(cue.startTime <= time && cue.endTime >= time && $.inArray(cue, track.shimActiveCues) == -1){
				track.shimActiveCues.push(cue);
				if(track.mode > 1 && showTracks[track.kind]){
					baseData.activeCues.push(cue);
				}
				$(track).triggerHandler('cuechange');
				$(cue).triggerHandler('enter');
				
				track._lastFoundCue.time = time;
				track._lastFoundCue.index = i;
				
				
			}
			if(cue.startTime > time){
				break;
			}
		}
	};
	
	if(usesNativeTrack()){
		(function(){
			var block;
			var triggerDisplayUpdate = function(elem){
				if(!block){
					setTimeout(function(){
						block = true;
						$(elem).triggerHandler('updatetrackdisplay');
						block = false;
					}, 9);
				}
			};
			var trackDesc = webshims.defineNodeNameProperty('track', 'track', {
				prop: {
					get: function(){
						triggerDisplayUpdate($(this).parent('audio, video'));
						return trackDesc.prop._supget.apply(this, arguments);
					}
				}
				
			});
			['audio', 'video'].forEach(function(nodeName){
				var addTrack, textTracks;
				textTracks = webshims.defineNodeNameProperty(nodeName, 'textTracks', {
					prop: {
						get: function(){
							triggerDisplayUpdate(this);
							return textTracks.prop._supget.apply(this, arguments);
						}
					}
				});
				
				addTrack = webshims.defineNodeNameProperty(nodeName, 'addTextTrack', {
					prop: {
						value: function(){
							triggerDisplayUpdate(this);
							return addTrack.prop._supvalue.apply(this, arguments);
						}
					}
				});
			});
		})();
	}
	
	webshims.addReady(function(context, insertedElement){
		$('video', context)
			.add(insertedElement.filter('video'))
			.each(function(){
				var trackList;
				var elem = $(this);
				var baseData;
				var addTrackView = function(){
					
					elem
						.unbind('.trackview')
						.bind('play.trackview timeupdate.trackview updatetrackdisplay.trackview', function(e){
							var track;
							var time;
							
							if(!trackList || !baseData){
								trackList = elem.prop('textTracks');
								baseData = webshims.data(elem[0], 'mediaelementBase') || webshims.data(elem[0], 'mediaelementBase', {});
								if(!baseData.displayedActiveCues){
									baseData.displayedActiveCues = [];
								}
							}
							
							if (!trackList){return;}
							time = elem.prop('currentTime');
							
							if(!time && time !== 0){return;}
							baseData.activeCues = [];
							for(var i = 0, len = trackList.length; i < len; i++){
								track = trackList[i];
								if(track.mode > 0 && track.cues && track.cues.length){
									webshims.mediaelement.getActiveCue(track, elem, time, baseData);
								} else {
									//remove form activeCues
								}
							}
							trackDisplay.update(baseData, elem);
							
						})
					;
				};
				if(!usesNativeTrack()){
					addTrackView();
				} else {
					elem.bind('mediaelementapichange trackapichange', function(){
						trackList = false;
						baseData = false;
						if(!usesNativeTrack() || elem.is('.nonnative-api-active')){
							addTrackView();
						} else {
							if(!trackList || !baseData){
								trackList = elem.prop('textTracks');
								baseData = webshims.data(elem[0], 'mediaelementBase') || webshims.data(elem[0], 'mediaelementBase', {});
							}
							
							$.each(trackList, function(i, track){
								trackDisplay.hide(track, baseData);
								if(track._shimActiveCues){
									delete track._shimActiveCues;
								}
							});
							elem.unbind('.trackview');
						}
					});
				}
			})
		;
	});
});