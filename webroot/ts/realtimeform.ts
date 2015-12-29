/// <reference path='jquery.d.ts'/>
'use strict';

var updateURL;
var appendURL;
var removeURL;
module RealtimeForm {
	function getRTFValue(control: JQuery) {
		var list = getRTFList(control);
		var value = control.attr('data-value');
		if (!value) {
			if (control.attr('type') == 'checkbox') {
				value = control.prop('checked');
			} else {
				value = control.text();
			}
		}
		return value;
	}

	function setRTFValue(control: JQuery, value) {
		var list = getRTFList(control);
		if (list) {
			control.attr('data-value', value);

			var name;
			if (value in list) name = list[value];
			else name = '-';

			control.html(name);

			var href = control.attr('href');
			if (href) {
				control.attr('href', href.replace(/\/[0-9]+$/, '/' + value));
			}
		} else if (control.attr('type') == 'checkbox') {
			control.prop('checked', value);
		} else {
			if (typeof(value) == 'string') value = value.replace(/(\r\n|\n|\r)/g, '$1<br>');
			control.html(value);
		}
	}

	function getRTFList(control: JQuery) {
		var listJSON = control.attr('data-list');
		if (!listJSON) return null;
		return JSON.parse(listJSON);
	}
	
	class RealtimeFormInput {
		public control: JQuery;
		public input: JQuery;
		public path: string;
		public value: any;
		public updateDone: boolean = false;

		constructor(control: JQuery, path: string) {
			this.control = control;
			this.path = path;

			this.control.prop('data-editing', true);

			this.value = getRTFValue(this.control); 

			if (this.control.attr('type') == 'checkbox') {
				this.input = $('<input type="checkbox">').prop('checked', !this.value).hide();
				this.control.fadeOut('fast');
				this.endEdit(null);
			} else {
				var list = getRTFList(this.control);
				if (list) {
					this.input = $('<select>').bind({
						'change': (e) => this.endEdit(e)
					});
					for (var key in list) {
						this.input.append($('<option>').val(key).html(list[key]));
					}
				} else {
					var type = this.control.attr('data-type');

					if (type == 'textarea') {
						this.input = $('<textarea>');
					} else {
						this.input = $('<input>');
						this.input.attr('type', this.control.attr('data-type'));
					}
				}

				this.input.addClass('rtf-input').val(this.value);
				this.input.hide().insertAfter(this.control).bind({
					'blur': (e) => this.endEdit(e)
				});

				this.control.fadeOut('fast', () => this.input.fadeIn('fast', () => this.input.focus()));
			}
		}

		endEdit(e) {
			this.input.fadeOut('fast');
			this.control.prop('data-editing', false);
			this.update();
		}

		update() {
			var newValue = (this.control.attr('type') == 'checkbox') ? this.input.prop('checked') : this.input.val();
			if (newValue != this.value) {
				var sPath = this.path.split('.');

				var rtf = this.control.closest('.rtf')

				var model, field;
				if (sPath.length >= 2) {
					model = sPath[0];
					field = sPath[sPath.length-1];
				} else if (sPath.length == 1) {
					model = rtf.attr('data-model');
					field = sPath[0];
				}

				if (!model || !field) return;

				var data = {
					id: rtf.attr('data-id'),
					model: model,
					field: field,
					value: newValue
				};

				$.ajax({
					url: updateURL,
					data: JSON.stringify(data),
					type: 'POST',
					dataType: 'json',
					success: (data: any) => this.setData(data, () => this.showControl())
				});
			} else {
				this.showControl();
			}
		}

		setData(data, callback?) {
			$('.rtf-control, .rtf-readonly').addClass('rtf-flag');

			var setDataImpl = function(data: any, basePath: string = '') {
				for (var key in data) {
					var path = basePath;
					if (path.length > 0) path += '.';
					path += key;

					if (typeof(data[key]) == 'object') {
						setDataImpl(data[key], path);
					} else {
						var attr = '[data-path="' + path + '"]';
						$('.rtf-control' + attr + ', .rtf-readonly' + attr).each(
								function(i: number, element: Element)  {
									var control = $(element);
									control.removeClass('rtf-flag');
									if (getRTFValue(control) != this.value) {
										control.fadeOut('fast', () => (
												setRTFValue(control, this.value),
												control.fadeIn('fast')
												)
											);
									}
								}.bind({value: data[key], path: path}));
					}
				}
			};

			setDataImpl(data);

			$('.rtf-control.rtf-flag[data-list], .rtf-readonly.rtf-flag[data-list]').each(
					function(i: number, elm: Element) {
						var control = $(elm);
						control.removeClass('rtf-flag');
						control.fadeOut('fast', () => (
								setRTFValue(control, ''),
								control.fadeIn('fast')
								)
							);
					}
			);

			if (callback) callback();
		}

		showControl() {
			if (this.input.css('display') != 'none') {
				setTimeout(() => this.showControl(), 100);
			} else {
				this.control.fadeIn('fast', () => this.input.remove());
			}
		}
	}

	class RealtimeFormInputAppender {
		public button: JQuery;
		public tbody: JQuery;
		public template: JQuery;
		public model: string;

		constructor(button: JQuery, tbody: JQuery, template: JQuery, model: string) {
			this.button = button;
			this.tbody = tbody;
			this.template = template;
			this.model = model;

			this.button.click((e) => this.append());
		}

		append() {
			$.ajax({
				url: appendURL,
				data: JSON.stringify({ model: this.model }),
				type: 'POST',
				dataType: 'json',
				success: (data: any) => this.onSuccess(data)
			});
		}

		onSuccess(id: number) {
			var l = this.tbody.find('tr').length;
			var line = this.template.clone().hide().removeClass('rtf-template').attr('data-id', id);
			line.find('[data-path]').each((index: number, element: HTMLElement) => {
				var target = $(element);
				target.attr('data-path', target.attr('data-path').replace('{n}', l.toString()));
			});
            setupRemoveButton(line.find('.rtf-remove')[0]);
			this.tbody.append(line);
			line.fadeIn('fast');
		}
	}

	class RealtimeFormInputRemover {
		public button: JQuery;
		public line: JQuery;
		public model: string;
		public id: number;

		constructor(button: JQuery, line: JQuery, model: string, id: number) {
			this.button = button;
			this.line = line;
			this.model = model;
			this.id = id;

			line.hover((e) => this.button.fadeIn('fast'), (e) => this.button.fadeOut('fast'));
			button.bind('click', (e) => this.remove(e));
		}

		remove(e: any) {
			if (confirm('本当に削除してもよいですか？')) {
				$.ajax({
					url: removeURL,
					data: JSON.stringify({model: this.model, id: this.id }),
					type: 'POST',
					dataType: 'json',
					success: (data) => this.line.fadeOut('fast', () => this.line.remove())
				});
			}
		}
	}

	class LongTouchListener {
		public control: JQuery;
		public path: string;
		public target: any;
		public timer: any;

		constructor(control: JQuery, path: string, target: any) {
			this.control = control;
			this.target = target;
			this.path = path;

			$(target).bind({
				'touchend': (e) => this.cancel(e),
				'touchcancel': (e) => this.cancel(e),
				'touchmove': (e) => this.cancel(e)
			});

			this.timer = setTimeout(() => this.process(), 500);
		}

		process() {
			var input = new RealtimeFormInput(this.control, this.path);
		}

		cancel(e) {
			clearTimeout(this.timer);
		}
	}

    function setupRemoveButton(element: HTMLElement) {
			var button = $(element);
			var line = $(element).closest('tr');
			var model = line.attr('data-model');
			var id = +line.attr('data-id');
			new RealtimeFormInputRemover(button, line, model, id);
    }

	function initRTF() {
		function getControl(e): JQuery {
			var rtfControl: JQuery;

			var originalTarget = $(e.target);

			if (originalTarget.hasClass('rtf-control')) {
				rtfControl = originalTarget;
			} else {
				rtfControl = originalTarget.closest('.rtf-control');
			}

			if (rtfControl.length == 0) {
				rtfControl = originalTarget.find('.rtf-control');
			}

			return rtfControl;
		}

		function edit(e) {
			var rtfControl:  JQuery = getControl(e);

			if (rtfControl.length == 1 && !rtfControl.prop('data-editing')) {

				var path = rtfControl.attr('data-path');
				if (path) {
                    e.preventDefault()
					var input = new RealtimeFormInput(rtfControl, path);
				}
			}
		}

		function handleLongTouch(e) {
			var rtfControl = getControl(e);

			if (rtfControl.length == 1 && !rtfControl.prop('data-editing')) {
				var path = rtfControl.attr('data-path');
				if (path) {
					var listener = new LongTouchListener(rtfControl, path, e.target);
				}
			}
		}

		$('.rtf').bind({
			'dblclick': (e) => edit(e),
			'touchstart': (e) => handleLongTouch(e)
		});

		$('.rtf-remove').each(function (index: number, element: HTMLElement) {
            setupRemoveButton(element);
		});

		$('.rtf-append').each(function (index: number, element: HTMLElement) {
			var button = $(element);
			var table = $(element).closest('table');
			var tbody = table.find('tbody');
			var template = table.find('.rtf-template');
			var model = template.attr('data-model');
			new RealtimeFormInputAppender(button, tbody, template, model);
		});
	}

	$(initRTF);
}


