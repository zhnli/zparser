//(function () {
    "use strict";
    function AssertException(message) { this.message = message; }
    AssertException.prototype.toString = function () {
        return 'AssertException: ' + this.message;
    };

    function log(message) {
        console.log(message);
    }

    function assert(exp, message) {
        if (!exp) {
            throw new AssertException(message);
        }
    }

    function Address(ip, port) {
        this.ip = ip;
        this.port = port;
        this.hostname = null;
        this.fqdn = null;
    }

    function PduSip() {
        this.top_line = null;
        this.msg_hash = null;
        this.branch_id = null;
        this.call_id = null;
        this.cseq = null;
        this.from_tag = null;
        this.to_tag = null;
    }

    function PduRtcp() {
        this.version = null;
        this.padding = null;
        this.fmt = null;
        this.packet_type = null;
        this._length = null;
        this.ssrc_packet_sender = null;
        this.ssrc_media_source = null;
        this.ssrc_sender = null;
        this.ssrc = null;
    }

    function Message(data) {
        this.context = null;
        this.start_line = null;
        this.end_line = null;
        this.timestamp = null;
        this.direction = null;
        this.from_address = null;
        this.to_address = null;
        this.msg_hash = null;
        this.pdu = null;
        this.src_unit = null;
        this.dst_unit = null;
        this.element = null;
    }

    function CallTrace(data) {
        this.context = null;
        this.start_line = null;
        this.end_line = null;
        this.timestamp = null;
        this.module = null;
        this.code_location = null;
        this.method = null;
        this.thread = null;
        this.info = null;
        this.element = null;
    }

    function Unit(name) {
        this.name = name;
        this.known_addresses= [];
        this.in_messages = [];
        this.out_messages = [];
        this.element = null;

        this.isMatch = function(address) {
            for (var i = 0; i < this.known_addresses.length; i++) {
                var a = this.known_addresses[i];
                if ((a.ip != null && a.ip == address.ip)
                    || (a.hostname != null && a.hostname == address.hostname)
                    || (a.fqdn != null && a.fqdn == address.fqdn)) {

                    return true;
                }
            }
            return false;
        };
    }

    function ParseContext() {
        this.raw_data = '';
        this.data_lines = [];
        this.text_window = null;
        this.local_address = null;

        this.parsers = [];
        this.filters = [];
        this.organizers = [];

        this.prefilter_message_num = 0;
        this.messages = [];
        this.units = [];
        this.groups = [];

        this.calls = [];

        this.findUnit = function(address) {
            for (var i = 0; i < this.units.length; ++i) {
                if (this.units[i].isMatch(address)) {
                    return this.units[i];
                }
            }
            return null;
        };
    }

    function PduRtcpParser(context, message, lines) {
        var line = null;
        var pdu = new PduRtcp();
        var results;

        for (var i = 0; i < lines.length; ++i) {
            line = lines[i];
            do {
                results = /^\s*Version:\s*(\S+)\s*$/.exec(line);
                if (results) {
                    !pdu.version && (pdu.version = results[1]);
                    break;
                }
                results = /^\s*Padding:\s*(\S+)\s*$/.exec(line);
                if (results) {
                    !pdu.padding && (pdu.padding = results[1]);
                    break;
                }
                results = /^\s*fmt:\s*(\S+|.*\(\S+\))\s*$/.exec(line);
                if (results) {
                    !pdu.fmt && (pdu.fmt = results[1]);
                    break;
                }
                results = /^\s*PacketType:\s*.*\((\S+)\)\s*$/.exec(line);
                if (results) {
                    !pdu.packet_type && (pdu.packet_type = results[1]);
                    break;
                }
                results = /^\s*Length:\s*(\S+)\s*bytes$/.exec(line);
                if (results) {
                    !pdu._length && (pdu._length = results[1]);
                    break;
                }
                results = /^\s*SSRCPacketSender:\s*(\S+)\s*$/.exec(line);
                if (results) {
                    !pdu.ssrc_packet_sender && (pdu.ssrc_packet_sender = results[1]);
                    break;
                }
                results = /^\s*SSRCMediaSource:\s*(\S+)\s*$/.exec(line);
                if (results) {
                    !pdu.ssrc_media_source && (pdu.ssrc_media_source = results[1]);
                    break;
                }
                results = /^\s*SSRCSender:\s*(\S+)\s*$/.exec(line);
                if (results) {
                    !pdu.ssrc_sender && (pdu.ssrc_sender = results[1]);
                    break;
                }
                results = /^\s*SSRC:\s*(\S+)\s*$/.exec(line);
                if (results) {
                    !pdu.ssrc && (pdu.ssrc = results[1]);
                    break;
                }
            } while (false);
        }
        if (pdu.fmt == '15') {
            pdu.top_line = '[RTCP-VSR] fmt='
                           + pdu.fmt
                           + '; PacketType='
                           + pdu.packet_type
                           + '; SSRCPS='
                           + pdu.ssrc_packet_sender
                           + '; SSRCMS='
                           + pdu.ssrc_media_source;
        } else if (pdu.fmt && pdu.fmt.indexOf('PLI') >= 0) {
            pdu.top_line = '[RTCP-PLI] fmt='
                           + pdu.fmt
                           + '; PacketType='
                           + pdu.packet_type
                           + '; SSRCPS='
                           + pdu.ssrc_packet_sender
                           + '; SSRCMS='
                           + pdu.ssrc_media_source;
        } else {
            pdu.top_line = '[RTCP] PacketType='
                           + pdu.packet_type
                           +'; SSRCSender='
                           + pdu.ssrc_sender
                           + (pdu.ssrc ? '; SSRC' + pdu.ssrc : '');
        }
        return pdu;
    }

    function LogCallFlowParser(context, linenum) {
        var regex_startline = /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}).*Module=\"([^\"]+)\"\s*Level=\"DEBUG\".*CodeLocation=\"([^\"]+)\".*Method=\"([^\"]+)\".*Thread=\"([^\"]+)\"\s*:(.*)/;
        var regex_endline = /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}).*Module=.*/;

        var call = null;

        for (var i = linenum; i < context.data_lines.length; i++) {
            var line = context.data_lines[i];
            var results = regex_startline.exec(line);
            if (results) {
                call = new CallTrace();
                call.context = context;
                call.start_line = i;
                call.end_line = i
                call.timestamp = results[1];
                call.module = results[2];
                call.code_location = results[3];
                call.method = results[4];
                call.thread = results[5];
                call.info = results[6];

                context.calls.push(call);

            } else if (call != null) {
                if (regex_endline.test(line)) {
                    call.end_line = i - 1;
                    break;
                }
            } else {
                return null;
            }
        }
        return i - 1;
    }

    function LogRTCPParser(context, linenum) {
        var regex_startline = /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}).*Module=\"developer.mediarouting.rtcp\"\s*Level=\"DEBUG\".*Method=\"RTCPLoggerFilter::logString\".*Detail=\"(\w+)\".*Stream-Type="STREAM_TYPE_VIDEO".*(Src|Dst)-ip=\"(\d+\.\d+\.\d+\.\d+)\".*(Src|Dst)-port=\"(\d+)\"/;

        var regex_endline = /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}).*Module=.*/;

        var msg = null;
        var pdu_lines = [];

        for (var i = linenum; i < context.data_lines.length; i++) {
            var line = context.data_lines[i];
            var results = regex_startline.exec(line);
            if (results) {
                msg = new Message();
                msg.context = context;
                msg.start_line = i;
                msg.end_line = i
                msg.timestamp = results[1];
                context.messages.push(msg);

                if (results[2] == 'Outbound') {
                    msg.direction = 'out';
                    msg.from_address = new Address(context.local_address.ip, null);
                    msg.to_address = new Address(results[4], results[6]);
                } else if (results[2] == 'Inbound') {
                    msg.direction = 'in';
                    msg.from_address = new Address(results[4], results[6]);
                    msg.to_address = new Address(context.local_address.ip, null);
                } else {
                    console.log(false, 'Unrecognized "Action" at line ' + i + ' : "' + line);
                }
            } else if (msg != null) {
                if (regex_endline.test(line)) {
                    msg.end_line = i - 1;
                    msg.pdu = PduRtcpParser(context, msg, pdu_lines);
                    break;
                } else {
                    pdu_lines.push(line);
                }
            } else {
                return null;
            }
        }
        if (msg.pdu == null) {
            console.log('Error: pdu=null at line ' + i);
        }
        return i - 1;
    }

    function PduSipParser(context, message, lines) {
        var line = null;
        var pdu = new PduSip();
        var results;

        for (var i = 0; i < lines.length; ++i) {
            line = lines[i];
            do {
                results = /^\s*\|\s*(\S.*\S)\s*$/.exec(line);
                if (results) {
                    pdu.top_line = results[1];
                    break;
                }
                results = /^\s*Via:.*;branch=(\w+)(;|$)/.exec(line);
                if (results) {
                    pdu.branch_id = results[1];
                    break;
                }
                results = /^\s*Call-ID:\s+(\S+)/.exec(line);
                if (results) {
                    pdu.call_id = results[1];
                    break;
                }
                results = /^\s*From:.*;tag=(\w+)(;|$)/.exec(line);
                if (results) {
                    pdu.from_tag = results[1];
                    break;
                }
                results = /^\s*To:.*;tag=(\w+)(;|$)/.exec(line);
                if (results) {
                    pdu.to_tag = results[1];
                    break;
                }
            } while (false);
        }
        return pdu;
    }

    function LogNetworkSipParser(context, linenum) {
        var regex_startline = /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}).*Module=\"network.sip\"\s*Level=\"DEBUG\".*Action=\"(\w+)\".*Local-ip=\"(\d+\.\d+\.\d+\.\d+)\".*Local-port=\"(\d+)\".*(Src|Dst)-ip=\"(\d+\.\d+\.\d+\.\d+)\".*(Src|Dst)-port=\"(\d+)\".*Msg-Hash=\"(\d+)\"/;

        var regex_endline = /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}).*Module=.*/;

        var msg = null;
        var pdu_lines = [];

        for (var i = linenum; i < context.data_lines.length; i++) {
            var line = context.data_lines[i];
            var results = regex_startline.exec(line);
            if (results) {
                msg = new Message();
                msg.context = context;
                msg.start_line = i;
                msg.end_line = i
                msg.timestamp = results[1];
                msg.msg_hash = results[9];
                context.messages.push(msg);

                if (results[2] == 'Sent') {
                    msg.direction = 'out';
                    msg.from_address = new Address(results[3], results[4]);
                    msg.to_address = new Address(results[6], results[8]);
                } else if (results[2] == 'Received') {
                    msg.direction = 'in';
                    msg.to_address = new Address(results[3], results[4]);
                    msg.from_address = new Address(results[6], results[8]);
                } else {
                    console.log(false, 'Unrecognized "Action" at line ' + i + ' : "' + line);
                }
            } else if (msg != null) {
                if (regex_endline.test(line)) {
                    msg.end_line = i - 1;
                    msg.pdu = PduSipParser(context, msg, pdu_lines);
                    break;
                } else {
                    pdu_lines.push(line);
                }
            } else {
                return null;
            }
        }
        if (msg.pdu == null) {
            console.log('Error: pdu=null at line ' + i);
        }
        return i - 1;
    }

    function BasicFilter(context) {
        var messages = context.messages;
        var messages_passed = [];
        var signatures = []
        var call_ids = [];

        function Signature(branch_id, call_id, from_tag, to_tag) {
            this.branch_id = branch_id;
            this.call_id = call_id;
            this.from_tag = from_tag;
            this.to_tag = to_tag;
        }

        function match_signature(branch_id, call_id, from_tag, to_tag) {
            var sig = null;
            for (var i = 0; i < signatures.length; ++i) {
                sig = signatures[i];
                // null matchs everything
                if ((!sig.branch_id || sig.branch_id == branch_id)
                    && (!sig.call_id || sig.call_id == call_id)
                    && (!sig.from_tag || sig.from_tag == from_tag)
                    && (!sig.to_tag || sig.to_tag == to_tag)) {
                        return true;
                }
            }
            return false;
        }

        for (var i = 0; i < messages.length; i++) {
            var message = messages[i];
            var pdu = message.pdu;

            do {
                if (!pdu || !pdu.top_line || pdu.top_line.length == 0) {
                    //console.log('[' + (message.start_line + 1) + '] ' + context.data_lines[message.start_line]);
                    break;
                }
                if (pdu.top_line.indexOf('OPTION') >= 0) {
                    signatures.push( new Signature(pdu.branch_id,
                                                   pdu.call_id,
                                                   pdu.from_tag,
                                                   pdu.to_tag) );
                    break;
                }
                if (match_signature(pdu.branch_id,
                                    pdu.call_id,
                                    pdu.from_tag,
                                    pdu.to_tag)) {
                    break;
                }
                if (message.from_address.ip == message.to_address.ip) {
                    break;
                }

                messages_passed.push(message);
            } while(false);
        }

        context.messages = messages_passed;
    }

    function RTCPFilter(context) {
        var messages = context.messages;
        var messages_passed = [];

        for (var i = 0; i < messages.length; i++) {
            var message = messages[i];
            var pdu = message.pdu;

            do {
                if (!pdu || !pdu.top_line || pdu.top_line.length == 0) {
                    break;
                }
                if (pdu.top_line.indexOf('VSR') < 0 && pdu.top_line.indexOf('RTCP') >= 0) {
                    break;
                }

                messages_passed.push(message);
            } while(false);
        }

        context.messages = messages_passed;
    }

    function BasicOrganizer(context) {
        var messages = context.messages;
        var units = context.units;
        for (var i = 0; i < messages.length; i++) {
            var message = messages[i];
            var from_addr = message.from_address;
            if (from_addr == null) {
                assert(false, message.start_line + ' from_addr==null');
            }
            var unit = context.findUnit(from_addr);
            if (unit == null) {
                unit = new Unit(from_addr.ip);
                if (from_addr.ip == undefined) {
                    assert(false, message.start_line + ' from_addr.ip==undefined');
                }
                unit.known_addresses.push(from_addr);
                context.units.push(unit);
            }
            unit.out_messages.push(message);
            message.src_unit = unit;

            var to_addr = message.to_address;
            if (to_addr == null) {
                assert(false, message.start_line + ' to_addr==null');
            }
            var unit = context.findUnit(to_addr);
            if (unit == null) {
                unit = new Unit(to_addr.ip);
                if (to_addr.ip == undefined) {
                    assert(false, message.start_line + ' to_addr.ip==undefined');
                }
                unit.known_addresses.push(to_addr);
                context.units.push(unit);
            }
            unit.in_messages.push(message);
            message.dst_unit = unit;
        }
    }

    function splitLines(data) {
        var lines = [];
        var i = 0;
        var j = 0;
        for (; i < data.length; ++i) {
            if (data[i] == '\r') {
                if (data[i+1] == '\n') {
                    lines.push(data.slice(j, i + 2));
                    j = i + 2;
                    ++i;
                } else {
                    lines.push(data.slice(j, i + 1));
                    j = i + 1;
                }
            } else if (data[i] == '\n') {
                lines.push(data.slice(j, i + 1));
                j = i + 1;
            }
        }
        // last line.
        if (i > j) {
            lines.push(data.slice(j));
        }
        return lines;
    }

    function runParsers(context) {
        var parsers = context.parsers;
        var endline = null;

        // Pass each line to parsers in percific order.
        // If the line matches parser's start line,
        // return the line number of the end match line.
        for (var m = 0; m < context.data_lines.length; ++m) {
            for (var n = 0; n < parsers.length; ++n) {
                endline = parsers[n](context, m);
                if (endline != null) {
                    m = endline;
                    break;
                }
            }
        }
    }

    function runFilters(context) {
        for (var i = 0; i < context.filters.length; i++) {
            context.filters[i](context);
        }
    }

    function runOrganizers(context) {
        for (var i = 0; i < context.organizers.length; i++) {
            context.organizers[i](context);
        }
    }

    function findLocalAddress(context) {
        var regex_str = /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}).*Module=\"network.sip\"\s*Level=\"DEBUG\".*Action=\"(\w+)\".*Local-ip=\"(\d+\.\d+\.\d+\.\d+)\".*Local-port=\"(\d+)\".*(Src|Dst)-ip=\"(\d+\.\d+\.\d+\.\d+)\".*(Src|Dst)-port=\"(\d+)\".*Msg-Hash=\"(\d+)\"/;

        var lines = context.data_lines;
        for (var i = 0; i < lines.length; i++) {
            var results = regex_str.exec(lines[i]);
            if (results) {
                context.local_address = new Address(results[3], null);
                break;
            }
        }
    }

    function genDiagramFromFile(file_data) {
        var context = new ParseContext();
        context.raw_data = file_data;

        context.parsers.push(LogNetworkSipParser);
        context.parsers.push(LogRTCPParser);

        context.filters.push(BasicFilter);
        /*===IFDEF-BasicLevel===*/
        context.filters.push(RTCPFilter); 
        /*===ENDIF===*/

        context.organizers.push(BasicOrganizer);

        context.data_lines = splitLines(context.raw_data);

        findLocalAddress(context);
        runParsers(context);

        context.prefilter_message_num = context.messages.length;
        runFilters(context);

        runOrganizers(context);

        return context;
    }

    function genFlowFromFile(file_data) {
        var context = new ParseContext();
        context.raw_data = file_data;

        context.parsers.push(LogCallFlowParser);

        context.data_lines = splitLines(context.raw_data);

        runParsers(context);

        return context;
    }
//})();
