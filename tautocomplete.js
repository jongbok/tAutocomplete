(function ($) {
    'use strict';

    $.fn.tautocomplete = function (options) {

        // default parameters
        var settings = $.extend({
            width: '30vw',
            columns: [],
            onchange: null,
            norecord: 'No Records Found',
            regex: '^[a-zA-Z0-9\b]+$',
            data: null,
            placeholder: null,
            theme: 'default',
            ajax: null,
            delay: 1000,
            highlight:'word-highlight',
            translator: null,
            idField: null,
            textField: null
        }, options);

        var cssClass = {
            'default': 'adropdown',
            'classic': 'aclassic',
            'white': 'awhite'};

        settings.theme = cssClass[settings.theme];
        settings.idField = settings.idField || settings.columns[0].field;
        settings.textField = settings.textField || (settings.columns.length > 1 ? settings.columns[1].field: settings.columns[0].field);
        
        // initialize DOM elements
        var el = {
            $origin: this,
            $ddDiv: $('<div>', { class: settings.theme }),
            $ddTable: $('<table></table>', { style: 'width:' + settings.width }),
            $ddTableCaption: $('<caption>' + settings.norecord + '</caption>'),
            $ddTextbox: $('<input type="text">')
        };

        var keys = {
            UP: 38,
            DOWN: 40,
            ENTER: 13,
            TAB: 9,
            BACKSPACE: 8
        };

        var errors = {
            columnNA: 'Error: Columns Not Defined',
            dataNA: 'Error: Data Not Available'
        };
        
        // plugin properties
        var tautocomplete = {
            id: function (val) {
               if(val !== null && val !== undefined){
                  $orginalTextBox.val(val);
                  selectedData = selectedData || {};
                  selectedData[settings.idField] = val;
               }
               return selectedData[settings.idField];
            },
            text: function (val) {
               if(val !== null && val !== undefined){
                  el.$ddTextbox.val(val);
                  selectedData = selectedData || {};
                  selectedData[settings.textField] = val;
               }
               return selectedData[settings.textField];
            },
            searchdata: function () {
                return el.$ddTextbox.val();
            },
            isNull: function () {
                return !selectedData[settings.idField];
            },
            all: function(){
                return selectedData;
            },
            destroy: function(){
               el.$ddTextbox.remove();
               el.$ddDiv.remove();
               el.$origin.unwrap();
            }
        };

        // delay function which listens to the textbox entry
        var delay = (function () {
            var timer = 0;
            return function (callsback, ms) {
                clearTimeout(timer);
                timer = setTimeout(callsback, ms);
            };
        })();

        var cols = settings.columns.length,
           $orginalTextBox = this,
           selectedData = {},
           focused = this.is(':focus');

        // wrap the div for style
        this.wrap('<div class="acontainer"></div>');

        // create a textbox for input
        this.after(el.$ddTextbox);
        el.$ddTextbox.attr('autocomplete', 'off');
        el.$ddTextbox.css('width', this.width + 'px');
        el.$ddTextbox.css('font-size', this.css('font-size'));
        if($.isFunction(settings.translator)){
            settings.translator(settings.placeholder).then(function(message){
               el.$ddTextbox.attr('placeholder', message);
            });
        }else{
           el.$ddTextbox.attr('placeholder', settings.placeholder);
        }

        // check for mandatory parameters
        if (!settings.columns) {
            el.$ddTextbox.attr('placeholder', errors.columnNA);
        }
        else if (!settings.data && !settings.ajax) {
            el.$ddTextbox.attr('placeholder', errors.dataNA);
        }
        
        // append div after the textbox
        this.after(el.$ddDiv);

        // hide the current text box (used for stroing the values)
        this.hide();

        // append table after the new textbox
        el.$ddDiv.append(el.$ddTable);
        el.$ddTable.attr('cellspacing', '0');

        // append table caption
        el.$ddTable.append(el.$ddTableCaption);

        // create table columns
        var $thead = $('<thead><tr></tr></thead>'),
           $tr = $thead.find('tr'),
           $th;

        for (var i = 0; i < cols; i++) {
            if($.isFunction(settings.translator)){
               (function (idx) {
                  settings.translator(settings.columns[idx].name)
                     .then(function(title){
                        $th = $('<th>' + title + '</th>');
                        settings.columns[idx].hide && $th.hide();
                        $tr.append($th);
                     })
               })(i);
            }else{
               $th = $('<th>' + settings.columns[i].name + '</th>');
               settings.columns[i].hide && $th.hide();
               $tr.append($th);
            }
        }
        el.$ddTable.append($thead);

        // assign data fields to the textbox, helpful in case of .net postbacks
       {
          var id = this.val(),
             text = this.data('text') || id;
          if(id){
             tautocomplete.id(id);
             tautocomplete.text(text);
          }
       }
        focused && el.$ddTextbox.focus();

        // autocomplete key press
        el.$ddTextbox.keyup(function (e) {
            //return if up/down/return key
            if ((e.keyCode < 46 || e.keyCode > 105) && (e.keyCode !== keys.BACKSPACE)) {
                e.preventDefault();
                return;
            }
            //delay for 1 second: wait for user to finish typing
            delay(function () {
                processInput();
            }, settings.delay);
        });

        // process input
        function processInput()
        {
            if (!el.$ddTextbox.val()) {
                 hideDropDown();
                 return;
            }

            // hide no record found message
            el.$ddTableCaption.hide();

            el.$ddTextbox.addClass('loading');

            if (settings.ajax)
            {
                var tempData = null;
                if ($.isFunction(settings.ajax.data)) {
                    tempData = settings.ajax.data.call(tautocomplete);
                }
                else{
                    tempData = settings.ajax.data;
                }
                // get json data
                $.ajax({
                    type: settings.ajax.type || 'GET',
                    dataType: 'json',
                    contentType: settings.ajax.contentType || 'application/json; charset=utf-8',
                    headers: settings.ajax.headers || { 'Content-Type': 'application/x-www-form-urlencoded' },
                    data: tempData || null,
                    url: settings.ajax.url,
                    success: ajaxData,
                    error: function (xhr, ajaxOptions, thrownError) {
                        el.$ddTextbox.removeClass('loading');
                        alert('Error: ' + xhr.status || ' - ' || thrownError);
                    }
                });
            }
            else if ($.isFunction(settings.data)) {
                var data = settings.data.call(tautocomplete);
                jsonParser(data);
            }
            else {
                // default function
                null;
            }
        }

        // call on Ajax success
        function ajaxData(jsonData)
        {
             if ($.isFunction(settings.ajax.success)) {
                 var data = settings.ajax.success.call(tautocomplete, jsonData);
                 jsonParser(data);
             }else{
                jsonParser(jsonData);
             }
        }

        // do not allow special characters
        el.$ddTextbox.keypress(function (event) {
            var regex = new RegExp(settings.regex);
            var key = String.fromCharCode(!event.charCode ? event.which : event.charCode);

            if (!regex.test(key)) {
                event.preventDefault();
                return false;
            }
        });

        // textbox keypress events (return key, up and down arrow)
        el.$ddTextbox.keydown(function (e) {

            var tbody = el.$ddTable.find('tbody');
            var selected = tbody.find('.selected');

            if (e.keyCode === keys.ENTER) {
                e.preventDefault();
                select();
            }
            if (e.keyCode === keys.UP) {
                el.$ddTable.find('.selected').removeClass('selected');
                if (selected.prev().length === 0) {
                    tbody.find('tr:last').addClass('selected');
                } else {
                    selected.prev().addClass('selected');
                }
            }
            if (e.keyCode === keys.DOWN) {
                tbody.find('.selected').removeClass('selected');
                if (selected.next().length === 0) {
                    tbody.find('tr:first').addClass('selected');
                } else {
                    el.$ddTable.find('.selected').removeClass('selected');
                    selected.next().addClass('selected');
                }
            }
        });

        // row click event
        el.$ddTable.delegate('tr', 'mousedown', function () {
            el.$ddTable.find('.selected').removeClass('selected');
            $(this).addClass('selected');
            select();
        });

        // textbox blur event
        el.$ddTextbox.focusout(function () {
            hideDropDown();
            // clear if the text value is invalid
           var text = selectedData[settings.textField];
            if ($(this).val() !== text) {
                $(this).val('');
                $orginalTextBox.val('');
                text && onChange();
            }
        });

        function select() {

            var $selected = el.$ddTable.find('tbody').find('.selected');
            selectedData = $selected.data('tvalue');

            var id = selectedData[settings.idField],
               text = selectedData[settings.textField];

            el.$ddTextbox.val(text);
            $orginalTextBox.val(id);
            hideDropDown();
            onChange();
            el.$ddTextbox.focus();
        }

        function onChange()
        {
            // onchange callback function
            if ($.isFunction(settings.onchange)) {
                settings.onchange.call(tautocomplete);
            }
            else {
                // default function for onchange
            }
        }

        function hideDropDown() {
            el.$ddTable.hide();
            el.$ddTextbox.removeClass('inputfocus');
            el.$ddDiv.removeClass('highlight');
            el.$ddTableCaption.hide();
        }

        function showDropDown() {

            var cssTop = (el.$ddTextbox.height() + 20) + 'px 1px 0px 1px';
            var cssBottom = '1px 1px ' + (el.$ddTextbox.height() + 20) + 'px 1px';

            // reset div top, left and margin
            el.$ddDiv.css('top', '0px');
            el.$ddDiv.css('left', '0px');
            el.$ddTable.css('margin', cssTop);

            el.$ddTextbox.addClass('inputfocus');
            el.$ddDiv.addClass('highlight');
            el.$ddTable.show();

            // adjust div top according to the visibility
            if (!isDivHeightVisible(el.$ddDiv)) {
                el.$ddDiv.css('top', -1 * (el.$ddTable.height()) + 'px');
                el.$ddTable.css('margin', cssBottom);
                if (!isDivHeightVisible(el.$ddDiv)) {
                    el.$ddDiv.css('top', '0px');
                    el.$ddTable.css('margin', cssTop);
                    $('html, body').animate({
                        scrollTop: (el.$ddDiv.offset().top - 60)
                    }, 250);
                }
            }
            // adjust div left according to the visibility
            if (!isDivWidthVisible(el.$ddDiv)) {
                el.$ddDiv.css('left', '-' + (el.$ddTable.width() - el.$ddTextbox.width() - 20) + 'px');
            }
        }
        function jsonParser(jsonData) {
            try{
                el.$ddTextbox.removeClass('loading');
                el.$ddTable.find('tbody').remove();

                var highlight = !!settings.highlight,
                    re = new RegExp(el.$ddTextbox.val(),'gi'),
                    i = 0, j = 0,
                    len = jsonData && jsonData.length ? jsonData.length: 0,
                    cell, $tr, $td;

                 for (i = 0; i < len; i++) {
                     // display only 15 rows of data
                     if (i >= 15)
                         break;

                     var obj = jsonData[i];
                     $tr = $('<tr></tr>');

                     for(j = 0; j < cols; j++){
                         cell = obj[settings.columns[j].field] || '&nbsp;';
                         cell += '';
                         highlight && settings.columns[j].highlight && (cell = cell.replace(re, '<span class="' + settings.highlight + '">$&</span>'));
                         $td = $('<td>' + cell + '</td>');
                         settings.columns[j].hide && $td.hide();
                         $tr.append($td);
                     }

                     if(i===0){el.$ddTable.append('<tbody></tbody>');}
                     $tr.data('tvalue', obj);
                     el.$ddTable.find('tbody').append($tr);
                 }

                // show no records exists
                len === 0 && el.$ddTableCaption.show();

                el.$ddTable.find('tbody').find('tr:first').addClass('selected');
                showDropDown();
            }
            catch (e)
            {
                alert('Error: ' + e);
            }
        }

        return tautocomplete;
    };

   function isDivHeightVisible(elem) {
      var docViewTop = $(window).scrollTop();
      var docViewBottom = docViewTop + $(window).height();

      var elemTop = $(elem).offset().top;
      var elemBottom = elemTop + $(elem).height();

      return ((elemBottom >= docViewTop) && (elemTop <= docViewBottom)
      && (elemBottom <= docViewBottom) && (elemTop >= docViewTop));
   }

   function isDivWidthVisible(elem) {
      var docViewLeft = $(window).scrollLeft();
      var docViewRight = docViewLeft + $(window).width();

      var elemLeft = $(elem).offset().left;
      var elemRight = elemLeft + $(elem).width();

      return ((elemRight >= docViewLeft) && (elemLeft <= docViewRight)
      && (elemRight <= docViewRight) && (elemLeft >= docViewLeft));
   }

}(jQuery));