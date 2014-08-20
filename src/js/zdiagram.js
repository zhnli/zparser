//(function () {
    "use strict";
    // Following the CSS convention
    // Margin is the gap outside the box
    // Padding is the gap inside the box
    // Each object has x/y/width/height properties
    // The x/y should be top left corner
    // width/height is with both margin and padding

    var g_context = null;
    var g_show_line_num = null;

    function showObjProp(obj) {
        var s = 'Prop:[';
        for (var prop in obj) {
            s += prop + ',';
        }
        s += ']';
        console.log(s);
    }

    Raphael.fn.line = function(x1, y1, x2, y2) {
        assert(_.all([x1,x2,y1,y2], _.isFinite), "parameters must be numeric");
        var line = this.path("M{0},{1} L{2},{3}", x1, y1, x2, y2);
        line.attr({
            'arrow-end'   : 'classic-wide-long',
            'stroke-width': 2
        });
        line.data('coordinates', {'x1':x1, 'y1':y1, 'x2':x2, 'y2':y2});
        return line;
    };

    Raphael.fn.box = function(x, y, w, h) {
        assert(_.all([x, y, w, h], _.isFinite), "parameters must be numeric");
        return this.rect(x, y, w, h);
    };

    function CallTraceElement() {
        this.model = null;
        this.text = null;
        this.isMarked = false;
    }

    function UnitElement() {
        this.model = null;
        this.text = null;
        this.head = null;
        this.vline = null;
    }

    function MessageElement() {
        this.model = null;
        this.text = null;
        this.hline = null;
        this.isMarked = false;
    }

    function unitMove(dx, dy) {
        var element = this.data('unit_element');

        var newheadx = element.head.ox + dx;
        if (newheadx < EDGE_X
            || newheadx + UNIT_WIDTH > CANVAS_WIDTH - EDGE_X) {
            return;
        }

        element.head.attr({x: element.head.ox + dx,
                           y: element.head.oy});
        element.text.attr({x: element.text.ox + dx,
                           y: element.text.oy});

        var ocord = element.vline.ocord;
        var newunitcord = {'x1': ocord['x1'] + dx,
                           'y1': ocord['y1'],
                           'x2': ocord['x2'] + dx,
                           'y2': ocord['y2']};
        element.vline.data('coordinates', newunitcord);

        var newpath = ['M',
                       newunitcord['x1'],
                       newunitcord['y1'],
                       'L',
                       newunitcord['x2'],
                       newunitcord['y2']].join(',');
        element.vline.attr({'path': newpath});

        // redraw messages
        var unit = element.model;
        var messages = [unit.out_messages, unit.in_messages];

        for (var i = 0; i < messages.length; ++i) {
            var direction = (i == 0 ? 'out' : 'in');
            for (var j = 0; j < messages[i].length; ++j) {
                var msgelement = messages[i][j].element;
                var msgcord = msgelement.hline.data('coordinates');
                if (direction == 'out') {
                    msgcord['x1'] = newunitcord['x1'];
                } else {
                    msgcord['x2'] = newunitcord['x2'];
                }
                var newpath = ['M',
                               msgcord['x1'],
                               msgcord['y1'],
                               'L',
                               msgcord['x2'],
                               msgcord['y2']].join(',');
                msgelement.hline.attr({'path': newpath});

                msgelement.text.attr({x: (msgcord['x1'] + msgcord['x2']) / 2});
            }
        }
    }

    function unitMoveStart() {
        var element = this.data('unit_element');
        element.head.ox = element.head.attr('x');
        element.head.oy = element.head.attr('y');
        element.text.ox = element.text.attr('x');
        element.text.oy = element.text.attr('y');

        var current_cord = element.vline.data('coordinates');
        element.vline.ocord = {'x1': current_cord['x1'],
                               'y1': current_cord['y1'],
                               'x2': current_cord['x2'],
                               'y2': current_cord['y2']};

    }

    function unitMoveEnd() {
    }

    function callHoverIn() {
        var call_element = this.data('call_element');
        call_element.text.attr( {'opacity': 0.5, 'font-weight': 'bold'});
    }

    function callHoverOut() {
        var call_element = this.data('call_element');
        if (call_element.isMarked) {
            call_element.text.attr({'opacity': 0.5, 'font-weight': 'bold'});
        } else {
            call_element.text.attr({'opacity': 1, 'font-weight': 'normal'});
        }
    }

    function unitHoverIn() {
        var unit_element = this.data('unit_element');
        unit_element.head.attr( {'opacity': 0.5, 'stroke-width': 3});
        unit_element.text.attr( {'opacity': 0.5, 'font-weight': 'bold'});
        unit_element.vline.attr({'stroke-width': 5});
    }

    function unitHoverOut() {
        var unit_element = this.data('unit_element');
        unit_element.head.attr( {'opacity': 1, 'stroke-width': 2});
        unit_element.text.attr( {'opacity': 1, 'font-weight': 'normal'});
        unit_element.vline.attr({'stroke-width': 4});
    }

    function msgHoverIn(text_window) {
        var func = function() {
            var msg_element = this.data('message_element');

            // Not change message hline color -
            // Because bug in Raphael that all arrows share global color.
            //msg_element.text.attr({'fill':Raphael.color('blue')});
            //msg_element.hline.attr({'stroke':Raphael.color('blue')});

            msg_element.text.attr( {'opacity': 0.5, 'font-weight': 'bold'});
            msg_element.hline.attr({'opacity': 0.5, 'stroke-width': 3});

            // Not use text window because it is useless with long texts.
            //var message = msg_element.model;
            //text_window.text(
            //    message.context.data_lines.slice(
            //        message.start_line,
            //        message.end_line+1
            //    ).join('\n')
            //);
            //text_window.fadeIn();
        }
        return func;
    }

    function msgHoverOut(text_window) {
        var func = function() {
            var msg_element = this.data('message_element');

            //msg_element.text.attr({'fill':Raphael.color('black')});
            //msg_element.hline.attr({'stroke':Raphael.color('black')});

            if (msg_element.isMarked) {
                msg_element.text.attr({'opacity': 1, 'font-weight': 'normal'});
                msg_element.hline.attr({'opacity':0.5, 'stroke-width': 3});
            } else {
                msg_element.text.attr({'opacity': 1, 'font-weight': 'normal'});
                msg_element.hline.attr({'opacity':1, 'stroke-width': 2});
            }

            //text_window.fadeOut(200);
            //text_window.hide();
        }
        return func;
    }

    function callOnClick(call_element) {
        var func = function() {
            var call = call_element.model;
            console.log('[' + (call.start_line + 1) + '] '
                        + call.context.data_lines.slice(
                              call.start_line,
                              call.end_line+1
                          ).join('')
            );
            call_element.isMarked = !call_element.isMarked;
        }
        return func;
    }

    function msgOnClick(message_element) {
        var func = function() {
            var message = message_element.model;
            console.log('[' + (message.start_line + 1) + '] '
                        + message.context.data_lines.slice(
                              message.start_line,
                              message.end_line+1
                          ).join('')
            );
            markMessagesAlike(message_element);
        }
        return func;
    }

    var SCREEN_WIDTH = screen.width - 50;
    var WINDOW_WIDTH = Math.max(1280, SCREEN_WIDTH)

    var CANVAS_WIDTH = null;//1280;
    var CANVAS_HEIGHT = null;//720;

    var EDGE_X = 5;
    var UNIT_X = 100;
    var UNIT_Y = 30;
    var UNIT_WIDTH = 20;
    var UNIT_HEIGHT = 10;
    var UNIT_GAP = null;

    var FIRST_HLINE_Y = UNIT_Y + UNIT_HEIGHT + 20;
    var LAST_HLINE_Y = null;

    var FIRST_CALL_Y = 25;
    var CALL_GAP = 15;
    var CALL_X = 10;

    function renderCallFlow(canvas, context) {
        // Assign the global context.
        g_context = context;

        var calls = context.calls;

        CANVAS_WIDTH = SCREEN_WIDTH;
        CANVAS_HEIGHT = calls.length * 10 + 100;

        var r = Raphael(canvas, CANVAS_WIDTH, CANVAS_HEIGHT);

        //for (var i = 0; i < calls.length; ++i) {
        for (var i = 0; i < 2000; ++i) {
            var call = calls[i];
            var element = new CallTraceElement();

            var y = FIRST_CALL_Y + i * CALL_GAP;

            var s = 'CodeLocation="' + call.code_location + '"';
            s += ' Method="' + call.method + '"';
            if (g_show_line_num) {
                s += ' [' + (call.start_line + 1) + ']';
            }

            element.text = r.text(CALL_X, y, s);
            element.text.attr({'cursor': 'pointer', 'text-anchor': 'start'});

            // So element's all parts can access this container element.
            element.text.data('call_element', element);
            element.text.hover(callHoverIn, callHoverOut);
            element.text.node.onclick = callOnClick(element);

            element.model = call;
            call.element = element;
        }
    }

    function renderDiagram(canvas, context) {
        // Assign the global context.
        g_context = context;

        var messages = context.messages;
        var units = context.units;
        var text_window = context.text_window;

        CANVAS_WIDTH = Math.max(units.length * 200, SCREEN_WIDTH);
        CANVAS_HEIGHT = messages.length * 30 + 100;
        LAST_HLINE_Y = CANVAS_HEIGHT - 20;

        if (units.length != 0) {
            UNIT_GAP = Math.min(CANVAS_WIDTH / units.length, 600);
        } else {
            UNIT_GAP = 600;
        }

        var r = Raphael(canvas, CANVAS_WIDTH, CANVAS_HEIGHT);

        var unit_elements = [];
        var message_elements = [];

        for (var i = 0; i < units.length; ++i) {
            var element = new UnitElement();
            var x = UNIT_X + i * UNIT_GAP;
            var x_center = x + UNIT_WIDTH / 2;
            element.head = r.box(x, UNIT_Y, UNIT_WIDTH, UNIT_HEIGHT);
            element.text = r.text(x_center, UNIT_Y - 10, units[i].name);
            element.vline = r.line(x_center, UNIT_Y + UNIT_HEIGHT,
                                   x_center, CANVAS_HEIGHT - 10);

            unit_elements.push(element);
            units[i].element = element;
            element.model = units[i];

            // Advanced features: hover, drag
            var color = Raphael.getColor();
            element.head.data('unit_element', element);
            element.text.data('unit_element', element);
            element.vline.data('unit_element', element);

            element.head.attr( {fill: color, stroke: color, "fill-opacity": 0.5, "stroke-width": 2, cursor: "ew-resize"});
            element.text.attr( {fill: color, stroke: color, "opacity": 1, "stroke-width": 1, cursor: "ew-resize"});
            element.vline.attr({fill: color, stroke: color, "opacity": 0.5, "stroke-width": 4, cursor: "ew-resize"});

            element.head.drag(unitMove, unitMoveStart, unitMoveEnd);
            element.text.drag(unitMove, unitMoveStart, unitMoveEnd);
            element.vline.drag(unitMove, unitMoveStart, unitMoveEnd);

            element.head.hover(unitHoverIn, unitHoverOut);
            element.text.hover(unitHoverIn, unitHoverOut);
            element.vline.hover(unitHoverIn, unitHoverOut);
        }

        var msg_gap = (LAST_HLINE_Y - FIRST_HLINE_Y) / messages.length;
        for (var i = 0; i < messages.length; ++i) {
            var message = messages[i];
            var element = new MessageElement();

            var x1 = message.src_unit.element.vline.getBBox().x;
            var x2 = message.dst_unit.element.vline.getBBox().x;
            var y = FIRST_HLINE_Y + i * msg_gap;
            assert(x1 != undefined && x2 != undefined, 'x1=' + x1 + ',' + 'x2=' + x2 + ',' + 'y=' + y);

            element.hline = r.line(x1, y, x2, y);
            var s = message.pdu.top_line;
            if (g_show_line_num) {
                s += ' [' + (message.start_line + 1) + ']';
            }
            // y-7.5 so that there is no gap between text and hline
            element.text = r.text((x1+x2)/2-10, y-7.5, s);

            // So element's all parts can access this container element.
            element.text.data('message_element', element);
            element.hline.data('message_element', element);

            element.text.hover(msgHoverIn(text_window), msgHoverOut(text_window));
            element.hline.hover(msgHoverIn(text_window), msgHoverOut(text_window));

            element.text.attr({cursor: "pointer"});
            element.hline.attr({cursor: "pointer"});

            element.text.node.onclick = msgOnClick(element);
            element.hline.node.onclick = msgOnClick(element);

            message_elements.push(element);
            element.model = message;

            message.element = element;
        }
    }

    function showLineNumber(isEnabled) {
        //console.log('showLineNumber');
        g_show_line_num = isEnabled;
        if (!g_context) return;

        var message;
        var messages = g_context.messages;
        for (var i = 0; i < messages.length; ++i) {
            message = messages[i];
            if (isEnabled) {
                message.element.text.attr( {
                    'text': message.pdu.top_line + ' [' + (message.start_line + 1) + ']'
                } );
            } else {
                message.element.text.attr( {
                    'text': message.pdu.top_line
                } );
            }
        }
    }

    function restoreMessageElement(msg_element) {
        //msg_element.text.attr({
        //    'stroke':Raphael.color('black'),
        //    'font-weight': 'normal',
        //    'opacity': 1
        //});
        msg_element.hline.attr({
            'stroke':Raphael.color('black'),
            'stroke-width': 2,
            'opacity': 1
        });
    }

    function markMessagesAlike(msgElement) {
        var do_mark = true;
        if (msgElement.isMarked) {
            do_mark = false;
        }

        var msg_chosen = msgElement.model;
        var call_id = msg_chosen.pdu.call_id;

        var msg = null;
        var messages = msg_chosen.context.messages;
        for (var i = 0; i < messages.length; ++i) {
            msg = messages[i];
            if (call_id && msg.pdu.call_id === call_id) {
                if (do_mark) {
                    msg.element.isMarked = true;
                    //msg.element.text.attr({
                    //    'stroke':Raphael.color('red'),
                    //    'opacity': 0.5
                    //});
                    msg.element.hline.attr({
                        'stroke':Raphael.color('red'),
                        'stroke-width': 3,
                        'opacity': 0.5
                    });
                } else {
                    msg.element.isMarked = false;
                    restoreMessageElement(msg.element);
                }
            } else if (msg.element.isMarked === true) {
                msg.element.isMarked = false;
                restoreMessageElement(msg.element);
            }
        }
    }

//})();
