/// <reference path='jquery.d.ts'/>
'use strict';
var updateURL;
var appendURL;
var removeURL;
var RealtimeForm;
(function (RealtimeForm) {
    function getRTFValue(control) {
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

    function setRTFValue(control, value) {
        var list = getRTFList(control);
        if (list) {
            control.attr('data-value', value);

            var name;
            if (value in list)
                name = list[value];
            else
                name = '-';

            control.html(name);

            var href = control.attr('href');
            if (href) {
                control.attr('href', href.replace(/\/[0-9]+$/, '/' + value));
            }
        } else if (control.attr('type') == 'checkbox') {
            control.prop('checked', value);
        } else {
            if (typeof (value) == 'string')
                value = value.replace(/(\r\n|\n|\r)/g, '$1<br>');
            control.html(value);
        }
    }

    function getRTFList(control) {
        var listJSON = control.attr('data-list');
        if (!listJSON)
            return null;
        return JSON.parse(listJSON);
    }

    var RealtimeFormInput = (function () {
        function RealtimeFormInput(control, path) {
            var _this = this;
            this.updateDone = false;
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
                        'change': function (e) {
                            return _this.endEdit(e);
                        }
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
                    'blur': function (e) {
                        return _this.endEdit(e);
                    }
                });

                this.control.fadeOut('fast', function () {
                    return _this.input.fadeIn('fast', function () {
                        return _this.input.focus();
                    });
                });
            }
        }
        RealtimeFormInput.prototype.endEdit = function (e) {
            this.input.fadeOut('fast');
            this.control.prop('data-editing', false);
            this.update();
        };

        RealtimeFormInput.prototype.update = function () {
            var _this = this;
            var newValue = (this.control.attr('type') == 'checkbox') ? this.input.prop('checked') : this.input.val();
            if (newValue != this.value) {
                var sPath = this.path.split('.');

                var rtf = this.control.closest('.rtf');

                var model, field;
                if (sPath.length >= 2) {
                    model = sPath[0];
                    field = sPath[sPath.length - 1];
                } else if (sPath.length == 1) {
                    model = rtf.attr('data-model');
                    field = sPath[0];
                }

                if (!model || !field)
                    return;

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
                    success: function (data) {
                        return _this.setData(data, function () {
                            return _this.showControl();
                        });
                    }
                });
            } else {
                this.showControl();
            }
        };

        RealtimeFormInput.prototype.setData = function (data, callback) {
            $('.rtf-control, .rtf-readonly').addClass('rtf-flag');

            var setDataImpl = function (data, basePath) {
                if (typeof basePath === "undefined") { basePath = ''; }
                for (var key in data) {
                    var path = basePath;
                    if (path.length > 0)
                        path += '.';
                    path += key;

                    if (typeof (data[key]) == 'object') {
                        setDataImpl(data[key], path);
                    } else {
                        var attr = '[data-path="' + path + '"]';
                        $('.rtf-control' + attr + ', .rtf-readonly' + attr).each(function (i, element) {
                            var _this = this;
                            var control = $(element);
                            control.removeClass('rtf-flag');
                            if (getRTFValue(control) != this.value) {
                                control.fadeOut('fast', function () {
                                    return (setRTFValue(control, _this.value), control.fadeIn('fast'));
                                });
                            }
                        }.bind({ value: data[key], path: path }));
                    }
                }
            };

            setDataImpl(data);

            $('.rtf-control.rtf-flag[data-list], .rtf-readonly.rtf-flag[data-list]').each(function (i, elm) {
                var control = $(elm);
                control.removeClass('rtf-flag');
                control.fadeOut('fast', function () {
                    return (setRTFValue(control, ''), control.fadeIn('fast'));
                });
            });

            if (callback)
                callback();
        };

        RealtimeFormInput.prototype.showControl = function () {
            var _this = this;
            if (this.input.css('display') != 'none') {
                setTimeout(function () {
                    return _this.showControl();
                }, 100);
            } else {
                this.control.fadeIn('fast', function () {
                    return _this.input.remove();
                });
            }
        };
        return RealtimeFormInput;
    })();

    var RealtimeFormInputAppender = (function () {
        function RealtimeFormInputAppender(button, tbody, template, model) {
            var _this = this;
            this.button = button;
            this.tbody = tbody;
            this.template = template;
            this.model = model;

            this.button.click(function (e) {
                return _this.append();
            });
        }
        RealtimeFormInputAppender.prototype.append = function () {
            var _this = this;
            $.ajax({
                url: appendURL,
                data: JSON.stringify({ model: this.model }),
                type: 'POST',
                dataType: 'json',
                success: function (data) {
                    return _this.onSuccess(data);
                }
            });
        };

        RealtimeFormInputAppender.prototype.onSuccess = function (id) {
            var l = this.tbody.find('tr').length;
            var line = this.template.clone().hide().removeClass('rtf-template').attr('data-id', id);
            line.find('[data-path]').each(function (index, element) {
                var target = $(element);
                target.attr('data-path', target.attr('data-path').replace('{n}', l.toString()));
            });
            setupRemoveButton(line.find('.rtf-remove')[0]);
            this.tbody.append(line);
            line.fadeIn('fast');
        };
        return RealtimeFormInputAppender;
    })();

    var RealtimeFormInputRemover = (function () {
        function RealtimeFormInputRemover(button, line, model, id) {
            var _this = this;
            this.button = button;
            this.line = line;
            this.model = model;
            this.id = id;

            line.hover(function (e) {
                return _this.button.fadeIn('fast');
            }, function (e) {
                return _this.button.fadeOut('fast');
            });
            button.bind('click', function (e) {
                return _this.remove(e);
            });
        }
        RealtimeFormInputRemover.prototype.remove = function (e) {
            var _this = this;
            if (confirm('本当に削除してもよいですか？')) {
                $.ajax({
                    url: removeURL,
                    data: JSON.stringify({ model: this.model, id: this.id }),
                    type: 'POST',
                    dataType: 'json',
                    success: function (data) {
                        return _this.line.fadeOut('fast', function () {
                            return _this.line.remove();
                        });
                    }
                });
            }
        };
        return RealtimeFormInputRemover;
    })();

    var LongTouchListener = (function () {
        function LongTouchListener(control, path, target) {
            var _this = this;
            this.control = control;
            this.target = target;
            this.path = path;

            $(target).bind({
                'touchend': function (e) {
                    return _this.cancel(e);
                },
                'touchcancel': function (e) {
                    return _this.cancel(e);
                },
                'touchmove': function (e) {
                    return _this.cancel(e);
                }
            });

            this.timer = setTimeout(function () {
                return _this.process();
            }, 500);
        }
        LongTouchListener.prototype.process = function () {
            var input = new RealtimeFormInput(this.control, this.path);
        };

        LongTouchListener.prototype.cancel = function (e) {
            clearTimeout(this.timer);
        };
        return LongTouchListener;
    })();

    function setupRemoveButton(element) {
        var button = $(element);
        var line = $(element).closest('tr');
        var model = line.attr('data-model');
        var id = +line.attr('data-id');
        new RealtimeFormInputRemover(button, line, model, id);
    }

    function initRTF() {
        function getControl(e) {
            var rtfControl;

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
            var rtfControl = getControl(e);

            if (rtfControl.length == 1 && !rtfControl.prop('data-editing')) {
                var path = rtfControl.attr('data-path');
                if (path) {
                    e.preventDefault();
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
            'dblclick': function (e) {
                return edit(e);
            },
            'touchstart': function (e) {
                return handleLongTouch(e);
            }
        });

        $('.rtf-remove').each(function (index, element) {
            setupRemoveButton(element);
        });

        $('.rtf-append').each(function (index, element) {
            var button = $(element);
            var table = $(element).closest('table');
            var tbody = table.find('tbody');
            var template = table.find('.rtf-template');
            var model = template.attr('data-model');
            new RealtimeFormInputAppender(button, tbody, template, model);
        });
    }

    $(initRTF);
})(RealtimeForm || (RealtimeForm = {}));
