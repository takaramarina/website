
/* Original code from: copyright Nikolaus Baumgarten http://nikkki.net */
// Infinite Flowers Zoomquilt 2023
// Edited by Marina Takara 8/5/2023

var zoom = (function(){
	var player;
	if ( document.createElement('canvas').getContext("webgl2") ) {
		player = "webgl"
	} else {
		player = "canvas"
	}
	console.log(player)

	var context, gl, shaderProgram;
	var speed = 6
	const maxspeed = 30
	var fx = false;
	//
	var tilewidth, tileheight, center_x, center_y, element_w, element_h, window_w, window_h;
	var startposition = 0;
	var z_position = 0
	var lastframe = null;
	var lastdrawn = null;
	// 
	var playback = true;
	var keyboardMap = {up:false,down:false};
	var keyboardmovementenabled = false;
	var scrollenabled = false;
	var touchstartY;
	var touchvalue = 0;
	var touching = false;
	var scrollvalue = 0;
	var speed = 6;
	var speedfactor = 1;
	var portrait = false;
	var visiblesteps = 2;
	//
	var imagesloaded = 0;
	var startloaded = false;
	var loading = true;
	var loaded = false
	var visitstart = Date.now();
	var infohidden = false;
	var steps = [];
	//
	var filterelements = $('.filtered');


	
	//
	var start = 0;

	// for (var i = 0; i < 54; i++) {
	// 	var n = start+i;
	// 	if (n >= 54) n -= 54;
	// 	imgarray.push('./full/garden'+n+'.png');
	// };

    const imgarray = [
		'1.jpg',
		'2.jpg',
		'3.jpg',
		'4.jpg',
		'5.jpg',
		'6.jpg',
		'7.jpg'
	  ];
      //console.log("images loaded xx");

	//


	// Get the canvas element and its WebGL context

	const canvas = document.getElementById("zc");

	if (player == 'canvas') {
		context = canvas.getContext('2d');

	} else if (player == 'webgl') {

		gl = canvas.getContext("webgl2");
		if (!gl) {
			alert("Unable to initialize WebGL.");
			return;
		}

		// Vertex shader
		const vsSource = `
			attribute vec2 aVertexPosition;
			attribute vec2 aTextureCoord;
			uniform mat3 uTransformationMatrix;
			uniform mat4 uProjectionMatrix;
			varying highp vec2 vTextureCoord;
			
			void main() {
			vec4 position = uProjectionMatrix * vec4(uTransformationMatrix * vec3(aVertexPosition, 1.0), 1.0);
			gl_Position = position;
			vTextureCoord = aTextureCoord;
			}
		`;

		// Fragment shader
		const fsSource = `
			varying highp vec2 vTextureCoord;
			uniform sampler2D uSampler;
			
			void main(void) {
				gl_FragColor = texture2D(uSampler, vTextureCoord);
			}
		`;

		// Orthographic Projection
		function orthographic(left, right, bottom, top, near, far) {
			return [
				2 / (right - left), 0, 0, 0,
				0, 2 / (top - bottom), 0, 0,
				0, 0, 2 / (near - far), 0,
				(left + right) / (left - right), (bottom + top) / (bottom - top), (near + far) / (near - far), 1
			];
		}
		
		// Compile shaders
		const vertexShader = gl.createShader(gl.VERTEX_SHADER);
		gl.shaderSource(vertexShader, vsSource);
		gl.compileShader(vertexShader);

		const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
		gl.shaderSource(fragmentShader, fsSource);
		gl.compileShader(fragmentShader);

		// Link the shaders into a program
		shaderProgram = gl.createProgram();
		gl.attachShader(shaderProgram, vertexShader);
		gl.attachShader(shaderProgram, fragmentShader);
		gl.linkProgram(shaderProgram);
		gl.useProgram(shaderProgram);

	}
	// SETUP

	function setup() {
		resize()
		applyResize()
		setupSteps();
		window.requestAnimationFrame(loop);
	}

	// SETUP STEPS

	function setupSteps() {
		steps = [];
		for (var i = 0; i < imgarray.length; i++) {
			steps.push(new ZoomStep(imgarray[i],i));
		}
	}

	// LOAD STATUS

	function areNextStepsLoaded() {
		var nextstepsloaded = true;
		for (var i = 0; i < visiblesteps; i++) {
			if (!(steps[ (Math.floor(z_position))%steps.length]).imgloaded ||
				(player == 'webgl' && !(steps[ (Math.floor(z_position))%steps.length]).textureloaded )) {
				nextstepsloaded = false;
			}
		}
		if (!nextstepsloaded && !loading) {
			loading = true;
			$('body').addClass('loading')
		} else if (nextstepsloaded && loading) {
			loading = false;
			$('body').removeClass('loading')
		}
		return nextstepsloaded
	}

	function isStartLoaded() {

	}

	function loadImagesAndTextures() {
		for (var i = 0; i < visiblesteps + 3; i++) {
			step = steps[ (Math.floor(z_position)+i)%steps.length ]
			if (! step.imgloaded && ! step.imgloading) {
				step.loadImage();
			} else if (player == 'webgl' && step.imgloaded && !step.textureloaded) {
				step.loadTexture();
			}
		}
	}

	function loadstatus(){
		loaded = (imagesloaded == steps.length)
		if (!startloaded) {
			startloaded = true;
			for (var i = 0; i < visiblesteps; i++) {
				if (! steps[i].imgloaded) {
					startloaded = false;
				}
			}
			if (startloaded) {
				$('body').addClass('startloaded');
			}
		}

	}

	// CLASS ZOOM STEP

	class ZoomStep {
		static positionBuffer = null;

		constructor(imgsrc, index) {
			this.index = index;
			this.imgloaded = false;
			this.imgsrc = imgsrc;
			this.image = new Image();
            this.crossOrigin = "anonymous";

			if (player == 'webgl' && !ZoomStep.positionBuffer) {
				ZoomStep.positionBuffer = gl.createBuffer();
				gl.bindBuffer(gl.ARRAY_BUFFER, ZoomStep.positionBuffer);
	
				const positions = [
					0, 0,
					1, 0,
					0, 1,
					1, 1,
				];
	
				gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
			}
		}

		loadImage() {
			if (!this.imgloaded && ! this.imgloading) {
				// console.log('load image ' + this.index)
				this.image.onload = ()=>{this.imageLoaded()};
				this.image.src = this.imgsrc;
				this.imgloading = true;
			}
		}

        
		imageLoaded() {
			window.setTimeout(()=>{
				this.imgloaded = true;
				imagesloaded++;
				if (imagesloaded == 1) {
					tilewidth = this.image.width;
					tileheight = this.image.height;
					console.log(tilewidth + ' x ' + tileheight)
					resize();
				}
				loadstatus()

				if (player == 'webgl') {
					this.loadTexture();
				}
			},0)
		}

        loadTexture() {
			// console.log('load texture ' + this.index )
			let s = Date.now()
            this.image.crossorigin = "anonymous";
			this.texture = gl.createTexture();
			gl.bindTexture(gl.TEXTURE_2D, this.texture);
			// Load the image into the texture
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, this.image);
			// Set texture parameters
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
			// Set the minification filter to use mipmapping
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
			// Generate the mipmaps
			gl.generateMipmap(gl.TEXTURE_2D);
			// Set the magnification filter (doesn't use mipmapping)
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
			this.textureloaded = true;
		}
		

		setPosition(x, y, width, height) {
			this.x = x;
			this.y = y;
			this.width = width;
			this.height = height;
		}

		draw() {
			if (!this.texture) {
				return;
			}
		
			gl.useProgram(shaderProgram);
				
			// Create a transformation matrix
			const transformationMatrix = [
				this.width, 0, 0,
				0, this.height, 0,
				this.x, this.y, 1
			];
		
			// Pass the transformation matrix to the shader
			const uTransformationMatrix = gl.getUniformLocation(shaderProgram, 'uTransformationMatrix');
			gl.uniformMatrix3fv(uTransformationMatrix, false, transformationMatrix);
		
			const aVertexPosition = gl.getAttribLocation(shaderProgram, "aVertexPosition");
			gl.enableVertexAttribArray(aVertexPosition);
			gl.bindBuffer(gl.ARRAY_BUFFER, ZoomStep.positionBuffer);
			gl.vertexAttribPointer(aVertexPosition, 2, gl.FLOAT, false, 0, 0);
		
			const aTextureCoord = gl.getAttribLocation(shaderProgram, "aTextureCoord");
			gl.enableVertexAttribArray(aTextureCoord);
			gl.bindBuffer(gl.ARRAY_BUFFER, ZoomStep.positionBuffer);
			gl.vertexAttribPointer(aTextureCoord, 2, gl.FLOAT, false, 0, 0);
		
			const uSampler = gl.getUniformLocation(shaderProgram, "uSampler");
			gl.activeTexture(gl.TEXTURE0);
			gl.bindTexture(gl.TEXTURE_2D, this.texture);
			gl.uniform1i(uSampler, 0);
		
			gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
		}
	
		multiplyMatrices3x3(a, b) {
			let result = new Float32Array(9);
			for (let i = 0; i < 3; i++) {
				for (let j = 0; j < 3; j++) {
					result[j + i * 3] = 0.0;
					for (let k = 0; k < 3; k++) {
						result[j + i * 3] += a[k + i * 3] * b[j + k * 3];
					}
				}
			}
			return result;
		}
	}

	// ANIMATION LOOP

	function loop(timestamp){
		var elapsed = 0;
		if (!lastframe) {
			lastframe = timestamp;
		} else {
			elapsed = timestamp - lastframe;
			lastframe = timestamp;
		}

		loadImagesAndTextures();
		const nextstepsloaded = areNextStepsLoaded(); 
		// CONTROL
		if (nextstepsloaded) {
			var zoomspeed = 0.0003*elapsed

			if (scrollvalue != 0) {
				z_position += scrollvalue / 1500
				scrollvalue = 0;
			}
			if (touchvalue != 0) {
				z_position += touchvalue / 2000
				if (! touching) {
					touchvalue = touchvalue * .9;
				}
			}
			if (keyboardMap.up && keyboardmovementenabled) {
				z_position += zoomspeed*10;
			} else if (keyboardMap.down && keyboardmovementenabled){
				z_position -= zoomspeed*10;
			} else if (playback) {
				z_position += (zoomspeed/8*((portrait)?speed*speedfactor:speed));
			}
			if (z_position<0) {
				z_position+=steps.length;
			}
			if (z_position>steps.length) {
				z_position-=steps.length;
			}
			if (z_position > 1.5 && !infohidden) {
				if (document.querySelector('.scrollinfo')) {
					document.querySelector('.scrollinfo').style.opacity = '0';
				}
				infohidden = true;
			}
		}

		// DISPLAY
		if (lastdrawn != z_position || ! nextstepsloaded) {
			lastdrawn = z_position;

			if (player == 'webgl') {
				prepareDrawWebGl();
			} else  {
				context.clearRect(0, 0, canvas.width, canvas.height);
			}
			// build array of visible steps, looping end to the beginning
			var steparray = [];
			for (var i = 0; i < visiblesteps; i++) {
				steparray.push( steps[ (Math.floor(z_position)+i)%steps.length ] );
			}
			// 
			var scale = Math.pow(2,(z_position%1));
			// draw the collected image steps
			for (var i = 0; i < steparray.length; i++) {
				var x = center_x - element_w/2*scale;
				var y = center_y - element_h/2*scale;
				var w = element_w*scale;
				var h = element_h*scale;

				if (steparray[i].imgloaded) {
					steparray[i].setPosition(x,y,w,h);
					if (player == 'webgl') {
						steparray[i].draw()
					} else  {
						context.drawImage(steparray[i].image,x,y,w,h);
					}
				}
				scale *= 0.5;
			}
		}

		if (fx === 'colors') {
			hue += elapsed/50;
			if (hue >= 360) hue-= 360;

			filterelements.css('-webkit-filter', 'hue-rotate('+hue+'deg)');
			filterelements.css('-moz-filter', 'hue-rotate('+hue+'deg)');
			filterelements.css('-ms-filter', 'hue-rotate('+hue+'deg)');
			filterelements.css('-o-filter', 'hue-rotate('+hue+'deg)');
			filterelements.css('filter', 'hue-rotate('+hue+'deg)');
		}

		window.requestAnimationFrame(loop);
	}

	// DRAW SCENE WEBGL

	function prepareDrawWebGl() {
		gl.clearColor(0.0, 0.0, 0.0, 1.0);
		gl.clear(gl.COLOR_BUFFER_BIT);
		gl.viewport(0, 0, canvas.width, canvas.height);

		var projectionMatrix = orthographic(0, window_w, window_h, 0, -1, 1);
		var projectionMatrixLocation = gl.getUniformLocation(shaderProgram, 'uProjectionMatrix');
		gl.uniformMatrix4fv(projectionMatrixLocation, false, new Float32Array(projectionMatrix));
	}

	// RESIZE

	function resize(scale){

		if(window.devicePixelRatio !== undefined) {
		    dpr = window.devicePixelRatio;
		} else {
		    dpr = 1;
		}
		var w = $(window).width();
		var h = $(window).height();
		window_w = w * dpr;
		window_h = h * dpr;
		
		center_x = window_w/2;
		center_y = window_h/2;

		if (window_w>window_h*(tilewidth/tileheight)){
			element_w = window_w;
			element_h = window_w*(tileheight/tilewidth);
		} else {
			element_w = window_h*(tilewidth/tileheight);
			element_h = window_h;
		}
		portrait = (window_h > window_w);
		lastdrawn = null;

		if (player == 'webgl') {
			applyResizeDebounced();
		} else {
			applyResize()
		}
	}

	function applyResize() {
		$('#zc').attr('width',window_w);
		$('#zc').attr('height',window_h);
		lastdrawn = null;
	}
	
	function debounce(func, wait) {
		let timeout;
		
		return function(...args) {
			clearTimeout(timeout);
			
			timeout = setTimeout(() => {
				func.apply(this, args);
			}, wait);
		};
	}
	
	const applyResizeDebounced = debounce(applyResize, 200);
	
	$(window).resize(function() {
		resize();
	});

	window.addEventListener("focus", function() {
		lastdrawn = null
	});


	/** UI **/

	$('#zc').click(function () {$('body').toggleClass('creditsvisible'); })

	if (fx == 'colors') {
		$("#colors").addClass('active');
		$('body').addClass('fxcolors')
	} else if (fx == 'sw') {
		$("#sw").addClass('active');
		filterelements.css('-webkit-filter', 'grayscale(100%)');
		filterelements.css('-moz-filter', 'grayscale(100%)');
		filterelements.css('-ms-filter', 'grayscale(100%)');
		filterelements.css('-o-filter', 'grayscale(100%)');
		filterelements.css('filter', 'grayscale(100%)');
		$('body').addClass('fxgrey')

	} else {
		$("#nofx").addClass('active');
	}

	/** SPEED CONTROL **/

	var speedcontrol = $('#speedcontrol');
	var speedhandle = $('#speedcontrol .handle');

	speedcontrol.on('pointerdown', speedstartdrag);

	function speedstartdrag (e) {
		var s = (e.offsetX) / (speedcontrol.width()) * 2 - 1;
		if (s < -1) s = -1;
		if (s > 1) s = 1;
		speed = s * maxspeed;
		updateSpeedHandle();
		$('body').addClass('dragging');
		window.addEventListener('pointermove', speeddrag);
		window.addEventListener('pointerup', stopdrag);
		playback = true;
	}
	var speeddrag = function (e) {
		var s = (e.clientX - speedcontrol.offset().left) / (speedcontrol.width()) * 2 - 1;
		if (s < -1) s = -1;
		if (s > 1) s = 1;
		speed = s * maxspeed;
		updateSpeedHandle();
	}
	var stopdrag = function (e) {
		window.removeEventListener('pointermove', speeddrag);
		window.removeEventListener('pointerup', stopdrag);
		$('body').removeClass('dragging');
	}

	var updateSpeedHandle = function (e) {
			var p = ((speed / maxspeed));
			var hp = 50 * p + 50 ;
			speedhandle.css('left', hp+'%');
	}

	updateSpeedHandle();

	/** HIDE CURSOR **/

	$(document).ready(function() { 

	    var idleMouseTimer;
	    var forceMouseHide = false;

	    $("body").css('cursor', 'none');

	    $("body").mousemove(mouseIdle);

	    function mouseIdle(e) {
	    	if(!forceMouseHide) {
                $("body").css('cursor', '');

                clearTimeout(idleMouseTimer);

                idleMouseTimer = setTimeout(function() {
	            	// if ($('body').hasClass('uihidden')) {
	                    $("body").css('cursor', 'none');
	                    forceMouseHide = true;
	                    setTimeout(function() {
	                         forceMouseHide = false;
	                    }, 200);
					// }
                }, 1000);
            }
	    } 

		$("body").css('cursor', '');

		setTimeout(mouseIdle, 10);

	});

	/* KEYBOARD */

	$(document).keydown(function(event) {
		if (event.which === 32) {
			playback = !playback;
			event.preventDefault();
		}
		if (event.which === 38) {keyboardMap.up = true;event.preventDefault();}
		if (event.which === 40) {keyboardMap.down = true;event.preventDefault();}
	});

	$(document).keyup(function(event) {
		if (event.which === 38) {keyboardMap.up = false;event.preventDefault();}
		if (event.which === 40) {keyboardMap.down = false;event.preventDefault();}
	});

	// SCROLL / TOUCH MOVEMENT

	if (scrollenabled) {

		canvas.addEventListener('wheel', (event) => {
			event.preventDefault();
			scrollvalue += event.deltaY
		});

		function onTouchStart(event) {
			touchstartY = event.touches[0].clientY;
			touching = true;
		}

		function onTouchMove(event) {
			const deltaY = event.touches[0].clientY - touchstartY;
			touchvalue += deltaY 
			if (touchvalue >= 200) touchvalue = 200
			if (touchvalue <= -200) touchvalue = -200
			event.preventDefault();
		}

		function onTouchEnd(event) {
			touching = false;
		}

		document.addEventListener('touchstart', onTouchStart, { passive: false });
		document.addEventListener('touchmove', onTouchMove, { passive: false });
		document.addEventListener('touchend', onTouchEnd, { passive: false });

	}
	
	/* Wakelock	*/

	var wakeLock = null;

	async function requestWakelock() {
		try {
			wakeLock = await navigator.wakeLock.request("screen");
		} catch (err) {
		}
	}

	function releaseWakelock() {
		wakeLock.release().then(() => {
			wakeLock = null;
		});		  
	}

	/** FULLSCREEN **/

	var isFullscreen = false;
	$('#fullscreen').mousedown(function(e) {
		toggleFullScreen();
	});
	$('#zc').dblclick(function (e) {
		toggleFullScreen();
		e.stopPropagation();
	})

	document.addEventListener('fullscreenchange', function () {
	    isFullscreen = !!document.fullscreen;
	    fullscreenchange();
	}, false);
	document.addEventListener('mozfullscreenchange', function () {
	    isFullscreen = !!document.mozFullScreen;
	    fullscreenchange();
	}, false);
	document.addEventListener('webkitfullscreenchange', function () {
	    isFullscreen = !!document.webkitIsFullScreen;
	    fullscreenchange();
	}, false);
	function fullscreenchange() {
	    if(isFullscreen) {
			$('#fullscreen').addClass('active');
			$('body').removeClass('creditsvisible');
			requestWakelock()
	    } else {
			$('#fullscreen').removeClass('active');
			releaseWakelock()
	    }
	}
	function toggleFullScreen() {
		if (!document.fullscreenElement && !document.mozFullScreenElement && !document.webkitFullscreenElement && !document.msFullscreenElement ) {
			if (document.documentElement.requestFullscreen) {
			  document.documentElement.requestFullscreen();
			} else if (document.documentElement.msRequestFullscreen) {
			  document.documentElement.msRequestFullscreen();
			} else if (document.documentElement.mozRequestFullScreen) {
			  document.documentElement.mozRequestFullScreen();
			} else if (document.documentElement.webkitRequestFullscreen) {
			  document.documentElement.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
			}
		} else {
			if (document.exitFullscreen) {
			  document.exitFullscreen();
			} else if (document.msExitFullscreen) {
			  document.msExitFullscreen();
			} else if (document.mozCancelFullScreen) {
			  document.mozCancelFullScreen();
			} else if (document.webkitExitFullscreen) {
			  document.webkitExitFullscreen();
			}
		}
	}

	//

	setup();


})();
