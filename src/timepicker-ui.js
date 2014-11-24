/**
 * TimePicker main unit.
 *
 * Created by Kaminsky Ilya on 21.11.14.
 */
(function($)
{
    $.fn.timePicker = function(options)
    {
        var opt = $.extend({
            // флаг того, что мы имеем дело с сенсорным экраном
            touchscreen: !!('ontouchstart' in window),
             // браузер поддерживает border-radius, box-shadow, background-size, opacity
            compatible: false,
            // минимальный радиус окружности, за пределами которой отслеживается движение
            // (чтобы не перемещать стрелки, когда указатель находится близко к центру циферблата)
            minActiveDistance : 20,
            // длина часовой и минутных стрелок (согласно изображению)
            // константы сделаны в расчете на то, что размер часов будет равен 200 пикселей.
            hourArrowLenth: 65, minuteArrowLength: 81,
            // время "по умолчанию": 12 часов
            defaultHour: 0, defaultMin: 0, PM: true,
            // хэндлер на открытие элемента
            onOpened: function() {},
            // хэндлер на закрытие элемента
            onClosed: function() {}
        },
            options);


        // Код для вставки элемента в документ.
        var clock_template = ( !opt.touchscreen )
            ?
                '<div class="time-picker time-picker-body" style="display: none">' +
                    '<div class="switch-wrapper"><div class="switch-image">AM</div></div>' +
                    '<div class="time-picker-arrow time-picker-hour"></div>' +
                    '<div class="time-picker-arrow time-picker-minute"></div>' +
                    '<div class="switch-wrapper"><div class="switch-button"></div></div>' +
                '</div>'
            :
                '<div class="time-picker-touch time-picker-body" style="display: none">' +
                    '<div class="switch-wrapper"><div class="switch-image">AM</div></div>' +
                    '<div class="time-picker-arrow time-picker-hour"></div>' +
                    '<div class="time-picker-arrow time-picker-minute"></div>' +
                    '<div class="switch-wrapper"><div class="switch-button"></div></div>' +
                '</div>';

        // создаем наш элемент, получаем на него ссылку
        var clockui = $(clock_template).appendTo('body').addClass( !!opt.compatible ? 'compatible' : 'advanced' );

        var MIN_DISTANCE = 2 * opt.minActiveDistance * opt.minActiveDistance,
            HOUR_ARROW_LENGTH = opt.hourArrowLenth,
            MINUTE_ARROW_LENGTH = opt.minuteArrowLength;

        // радиус "активной" точки на стрелках - точки, за которую можно будет
        // перемещать стрелку
        var ARROW_ACTIVE_POIN_RADIUS = 10;

        // половинный размер часов = локальные координаты центра циферблата
        var clock_half_size =
        {
            w: clockui.width() / 2,
            h: clockui.height() / 2
        };

        // текущее значение времени
        var hours = opt.defaultHour,
            minutes = opt.defaultHour,
            pm_time = opt.PM;


        // флаг: режим вращения стрелок активирован
        var moving;

        // какая стрелка сейчас поворачивается: обе (both), часовая (hour), минутная (minute) ?
        var arrow;

        // текущие экранные позиции часов
        var clock_pos;

        // текущая позиция центра циферблата
        var shift_pos;

        // связанный элемент (в текущий момент времени)
        var input;

        // выведен ли циферблат часов в текущий момент?
        var showing = false;



        /**
         * Проверяет, находится ли курсор вблизи конца стрелки часов.
         *
         * @param arrow_len длина стрелки
         * @param angle угол поворота стрелки
         * @param pos позиция указателя мыши (локальные координаты)
         * @returns {boolean}
         */
        var anchorTest = function( arrow_len, angle, pos )
        {
            var x = arrow_len * Math.cos((angle - 90) / 180 * Math.PI);
            var y = arrow_len * Math.sin((angle - 90) / 180 * Math.PI);

            return ( ((x - pos.x)*(x - pos.x) + (y - pos.y)*(y - pos.y)) <= 2*ARROW_ACTIVE_POIN_RADIUS*ARROW_ACTIVE_POIN_RADIUS );
        };


        /**
         * Вовзращает угол между вертикальной осью циферблата (направление на 12 часов) и
         * вектором, направленным от центра циферблата к текущей позиции мыши.
         *
         * @param x координата указателя мыши
         * @param y координата указателя мыши
         * @returns угол в градусах
         */
        var getAngle = function( x, y )
        {
            var angle, m, a;

            if ( Math.abs(x) >  Math.abs(y) )
            {
                m = y / x;
                a = Math.atan(m) / Math.PI* 180;

                angle = (x > 0) ? a + 90 : a + 270;
            }
            else
            {
                m = x / y;
                a = 90 - Math.atan(m) / Math.PI * 180;

                angle = (y > 0) ? a + 90 : a + 270;
                if ( angle >= 360 ) angle -= 360;
            }

            return angle;
        };


        /**
         * Обновляет значение времени в связанном поле
         */
        var updateTimeElement = function()
        {
            var h = hours, m = minutes;

            h = (pm_time) ? h%12 + 12 : h%12; // поправка на 24-часовое время

            h = (h < 10) ? '0' + h : h;
            m = (m < 10) ? '0' + m : m;

            // если с нашим элементом связан еще и календарь
            if ( input.data().hasDatepicker )
            {
                // впишем время в основное и подолнительные текстовые поля
                input.val(input.val().replace(/ T$| ?\d{2}:\d{2} ?|^T | T /, ' ' + h + ':' + m + ' ').trim());

                var alts = input.datepicker('option', 'altField');
                if ( alts )
                {

                    $(alts).each(function()
                    {
                        this.value = this.value.replace(/ T$| ?\d{2}:\d{2} ?|^T | T /, ' ' + h + ':' + m + ' ').trim();
                    })
                }
            }
            else
                input.val(h + ":" + m);

            // сохраним время в связанных данных объекта, чтобы можно было их удобно получать
            var data = input.data();
            data.hours = hours;
            data.minutes = minutes;
            data.pm_time = pm_time;
            data.time = ((hours + pm_time?12:0)*60 + minutes)*60;
        };


        /**
         * Устанавливает время на часах, согласно значению внутренних переменных hours и minutes, а также pm_time.
         */
        var updateClockElement = function()
        {
            var
                // углы поворота часовой и минутной стрелок в градусах
                h = parseInt(hours%12*30 + minutes/2),
                m = minutes * 6,
                myNav = navigator.userAgent.toLowerCase(),
                IE = (myNav.indexOf('msie') != -1) ? parseInt(myNav.split('msie')[1]) : false;

            // О, да! Самый продуманный браузер. Нет ничего проще, чем провернуть изображение в ослике!
            if ( IE !== false && IE < 9 )
            {
                var
                // углы поворота часовой и минутной стрелок в радианах
                ah = h / 180 * Math.PI,
                am = m / 180 * Math.PI,
                // косинусы и синусы углов, для построения матрицы поворота
                hcos = Math.cos(ah), hsin = Math.sin(ah),
                mcos = Math.cos(am), msin = Math.sin(am),
                // выражения для фильтров с матрицами поворота часовой и минутной стрелок
                hf = 'M11 = ' + hcos + ', M12 = ' + (-hsin) + ', M21 = ' + hsin + ', M22 = ' + hcos,
                mf = 'M11 = ' + mcos + ', M12 = ' + (-msin) + ', M21 = ' + msin + ', M22 = ' + mcos,
                // вот такая шайтан-строка нужна чтобы повернуть стрелки (высший матан рулит ;-)
                hcss = 'progid:DXImageTransform.Microsoft.Matrix(' + hf + ", sizingMethod = 'auto expand')",
                mcss = 'progid:DXImageTransform.Microsoft.Matrix(' + mf + ", sizingMethod = 'auto expand')";
                // а все для того, чтобы установить парочку специфичных свойств
                th = {'filter': hcss, '-ms-filter': hcss};
                tm = {'filter': mcss, '-ms-filter': mcss};
                // "магические" поправочные коэффициенты смещения стрелок (только IE, только магия!)
                // FIXME: тот кто будет менять плагин должен учесть: они зависят от выбранного размера циферблата!
                // FIXME: либо убрать этот массив, либо реализовать формулу, по его вычислению
                var coefs = [0, 1, 2, 3, 5, 6, 6, 9, 11, 12, 14, 15, 16, 18, 19, 20, 22, 23, 24, 25, 26, 27, 28, 29,
                            30, 31, 32, 33, 33, 34, 35, 35, 36, 36, 37, 37, 38, 38, 38, 39, 39, 39, 39, 39, 39, 39];

                // без этого магического смещения стрелки будут скакать по странице, а не вращаться вокруг своего центра
                var hh = Math.abs(h) % 90;
                    hh = (hh < 45) ? hh : 90 - hh;
                    hh = -coefs[hh];

                var mm = Math.abs(m) % 90;
                    mm = (mm < 45) ? mm : 90 - mm;
                    mm = -coefs[mm];

                clockui.find('.time-picker-hour').css(th).css({'left': hh + 'px', 'top': hh + 'px'});
                clockui.find('.time-picker-minute').css(tm).css({'left': mm + 'px', 'top': mm + 'px'});
            }
            else
            {
                // для нормальных браузеров
                var
                // css-выражение для трансформации (боже мой, как же здесь просто!)
                rh = 'rotate(' + h +'deg)',
                rm = 'rotate(' + m +'deg)',
                // CSS-стили для трансформации (кросбраузерный стиль)
                th = {'-webkit-transform': rh, '-moz-transform': rh, '-ms-transform': rh, '-o-transform': rh, '-sand-transform': rh, 'transform': rh},
                tm = {'-webkit-transform': rm, '-moz-transform': rm, '-ms-transform': rm, '-o-transform': rm, '-sand-transform': rm, 'transform': rm};

                clockui.find('.time-picker-hour').css(th);
                clockui.find('.time-picker-minute').css(tm);
            }
            var img = clockui.find('.switch-image').text( (pm_time) ? 'PM' : 'AM');
            if ( pm_time ) img.addClass('pm_time'); else img.removeClass('pm_time');
        };


        /**
         * Выполняет анимированный поворот указанной стрелки часов к требуемому значению.
         * Используется для сенсорных экранов.
         *
         * @param arrow стрелка
         * @param angle угол, куда повернуть
         * @param old_angle откуда
         * @param fadein нужно ли плавно проявить стрелку?
         */
        var animateArrow = function( arrow, angle, old_angle, fadein )
        {
            $('<div>').css({left: (old_angle || 0)+'px', top: '-10px', width: 1, height: 1, position: 'absolute'})

            .animate({left: angle}, {
                duration: 400,
                step: function( now, fx )
                {
                    var r = 'rotate(' + now +'deg)',
                        s = {'-webkit-transform': r, '-moz-transform': r, '-ms-transform': r, '-o-transform': r, '-sand-transform': r, 'transform': r};

                    arrow.css(s);
                }
            });

            if ( fadein ) arrow.css({opaсity: 0}).animate({opacity: 1}, 800);
        };

        /**
         * Выполняет разбор времени, указанном в текстовом поле ввода.
         * Устанавливает время в элементе (если оно корректно).
         * Внимание: ранее использовалась parseInt, но она для строк '08' возвращает 0.
         * (возможно все дело из-за поддержки восмиричной системы счисления).
         *
         * @param value текст в поле ввода
         * @returns {boolean} true, если время корректно
         */
        var parseTime = function( value )
        {
            // проверям частичное совпадание времени по шаблонам
            var found_1 = value.match(/\d?\d:\d\d/g);
            var found_2 = value.match(/\d?\d:\d/g);
            var found_3 = value.match(/\d?\d:?/g);

            if ( found_1 || found_2 || found_3 )
            {
                var time, h = hours, m = minutes;

                if ( found_1 ) // полная дата
                {
                    time = found_1[0].match(/(\d?\d)/g);
                    h = time[0]*1; m = time[1]*1;
                }
                else
                if ( found_2 ) // часы есть, первая цифра минуты
                {
                    var re = /(\d?\d):(\d)/g; time = re.exec(found_2[0]);
                    h = time[1]*1; m = time[2]*1;
                    m = (m < 6) ? m * 10 : m;
                }
                else
                if ( found_3 ) // набраны только часы
                {
                    h = found_3[0]*1; m = 0;
                }

                // проверка корректности введенного времени
                if ( (h > 23) || (m > 59) ) return false;

                // приводим время к 12-часовому формату
                pm_time = (h > 11);
                if (h > 12) h -= 12;

                hours = h; minutes = m; return true;
            }
            return false;
        };


        /**
         * Ищет позицию, в которой лучше всего вывести циферблат
         *
         * @returns {*} позицию {left, top}
         */
        var findBestPosition = function()
        {
            var
                // координаты левого верхнего угла окна браузера в пространстве документа
                sx = $(document).scrollLeft(),
                sy = $(document).scrollTop(),
                // координаты правого нижнего угла окна браузера в пространстве документа
                bx = window.innerWidth + sx,
                by = window.innerHeight + sy;

            // координаты прямоугольника внутри координатной системы документа, часть которого видна в окне браузера (viewport)
            var windowRect = {left: sx, top: sy, right: bx, bottom: by};

            // проверяет, находится ли innerRect целиком в outerRect
            // на самом деле мы будем проверять: попадают ли часы в окно браузера целиком или нет.
            var isInRectFully = function( outerRect, innerRect )
            {
                return !(
                    innerRect.right > outerRect.right ||
                    innerRect.left < outerRect.left ||
                    innerRect.top < outerRect.top ||
                    innerRect.bottom > outerRect.bottom);
            };

            // возвращает координаты прямоугольника часов, для позиции (X, Y)
            var getClockRect = function( x, y )
            {
                return {left: x, top: y, right: x + clockui.outerWidth(), bottom: y + clockui.outerHeight() };
            };

            var clockRect;

            // вначале попытаемся разместить часы стандартно под текстовым полем
            clockRect = getClockRect(input.offset().left, input.offset().top + input.outerHeight());
            if ( isInRectFully(windowRect, clockRect) )
            {
                return clockRect;
            }

            // Не беда. Попробуем разместить сверху элемента
            clockRect = getClockRect(input.offset().left, input.offset().top - clockui.outerHeight());
            if ( isInRectFully(windowRect, clockRect) )
            {
                return clockRect;
            }

            // Ок. Тогда попытаемся отцентрировать часы по вертикали, и вывести справа от текстового поля
            clockRect = getClockRect(
                input.offset().left + input.outerWidth(),
                windowRect.top +  parseInt(($(window).innerHeight() - clockui.outerHeight()) / 2)
            );
            if ( isInRectFully(windowRect, clockRect) )
            {
                return clockRect;
            }

            // Да лано?! Попробуем разместить циферблат левее текстового поля и под ним.
            clockRect = getClockRect(input.offset().left + input.outerWidth() - clockui.outerWidth(), input.offset().top + input.outerHeight());
            if ( isInRectFully(windowRect, clockRect) )
            {
                return clockRect;
            }

            // Да чтоб тебя! Попробуем разместить циферблат левее текстового поля и над ним.
            clockRect = getClockRect(clockRect.left, input.offset().top - clockui.outerHeight());
            if ( isInRectFully(windowRect, clockRect) )
            {
                return clockRect;
            }

            // Жесть! Попробуем разместить циферблат левее текстового поля и по центру экрана.
            clockRect = getClockRect(input.offset().left - clockui.outerWidth(), windowRect.top +  parseInt(($(window).innerHeight() - clockui.outerHeight()) / 2));
            if ( isInRectFully(windowRect, clockRect) )
            {
                return clockRect;
            }

            // Ха. Последняя надежда разместить циферблат левее текстового поля (и по центру экрана конечно же)
            clockRect = getClockRect(
                input.offset().left - clockui.outerWidth(),
                windowRect.top +  parseInt(($(window).innerHeight() - clockui.outerHeight()) / 2)
            );
            if ( isInRectFully(windowRect, clockRect) )
            {
                return clockRect;
            }

            // Вау! Похоже на экране слишком мало место. Попробуем вывести часы по центру окна.
            clockRect.left = windowRect.left +  parseInt(($(window).innerWidth() - clockui.outerWidth())) / 2;
            return clockRect;

            /**
             * TODO: существует вероятность, что часы вообще не уместятся на экране. И выполнить с ними работу будет невозможно.
             * Фактически они в такой ситуацией станут помехой.В данной версии циферблата 200х200 такое может, конечно, случиться.
             * Но, скорее всего - такой размер окна обусловлен не размером устройства, а тем, что окно браузера уменьшено пользователем вручную.
             * Однако, все-таки стоит учесть эту потенциальную ошибку в тех ситуациях, когда пользователь плагина
             * захочет создать свой стиль циферблата для мобильных устройств и выберет базовый размер 400px и более.
             * Наша стратегия в этой ситуации: не показывать циферблат вовсе, позволяя вернуться к вводу "по старинке".
             */
        };


        /**
         * Избавление от дублирования логики
         */
        var hide = function()  { arrow = undefined; clockui.hide(); showing = false; opt.onClosed(); };
        var show = function()  { arrow = undefined; clockui.show(); showing = true; opt.onOpened();  };



        /**
         * Серия обработчиков событий мыши для циферблата часов.
         * Логика управления позицией стрелок мыши.
         */
        clockui.on('mousedown touchstart', function(e)
        {
            // только если была нажата левая кнопка мыши
            if (!opt.touchscreen && (e.which != 1 || !showing)) return;

            // проверяем: к нам ли поступил вызов, сверяясь с именем тега
            if ( e.target.className == 'switch-button' ) return;

            // определяем текущую позицию циферблата (она может меняться, т.к.
            // у нас всплывающее окно)
            clock_pos = clockui.offset();

            // координаты смещения центра циферблата (относительно страницы)
            shift_pos = {
                x: clock_pos.left + (clock_half_size.w),
                y: clock_pos.top + (clock_half_size.h)
            };

            // Только для сенсорных экранов: установка времени в 2 клика
            //
            if ( opt.touchscreen )
            {
                var p = {
                    x: e.originalEvent.touches ? e.originalEvent.touches[0].pageX : e.pageX - shift_pos.x,
                    y: e.originalEvent.touches ? e.originalEvent.touches[0].pageY : e.pageY - shift_pos.y
                };

                // на какую цифру указал пользователь?
                var angle = getAngle(p.x, p.y); // [0..360)

                // тип стрелки: в первый раз устанавливаем часы, в следующий - минуты
                arrow = ( arrow ) ?  arrow : 'hour';

                // вращаем стрелку от текущей позиции, заодно выставлем время
                if ( arrow == 'hour' )
                {
                    angle = Math.round(angle / 30) * 30;
                    animateArrow( clockui.find('.time-picker-hour'), angle + 360, hours*30 + minutes/2 );
                    hours = angle / 30;

                    //if (pm_time) hours += 12;
                    //if (hours > 23) hours -= 24;
                    if (hours > 11) hours -= 12;

                    arrow = 'minute';
                }
                else
                if ( arrow == 'minute' )
                {
                    angle = Math.round(angle / 30) * 30;
                    animateArrow( clockui.find('.time-picker-minute'), angle + 360, minutes*6, false );
                    animateArrow( clockui.find('.time-picker-hour'), hours*30 + angle/12, hours*30, false );
                    minutes = angle / 6;

                    arrow = 'close-button';
                }
                else
                if ( arrow == 'close-button' )
                {
                    hide(); return;
                }

                // обновляем связанный элемент
                updateTimeElement();

                e.stopPropagation();
                e.preventDefault();
                return;
            }

            // начинаем режим движения стрелок
            moving = true;

            /// вычисляем локальные координаты мыши относительно центра циферблата
            var pos = {x: e.pageX - shift_pos.x, y: e.pageY - shift_pos.y};

            // теперь попытаемся угадать, какую из стрелок хочет повернуть пользователь.

            // находится ли указатель мыши вблизи конца стрелок часов?
            if ( anchorTest(HOUR_ARROW_LENGTH, hours * 30, pos) )
            {
                arrow = "hour";
            }
            else
            if ( anchorTest(MINUTE_ARROW_LENGTH, minutes * 6, pos) )
            {
                arrow = "minute";
            }
            else
                arrow = "both";


            // если курсор далеко от конца стрелок, попытаеся определить по углам
            if ( arrow == "both" )
            {
                angle = getAngle(pos.x, pos.y); // угол курсора мыши

                if ( Math.abs((hours*30 + minutes/2) - angle) < 6 )
                {
                    arrow = "hour";
                }
                else
                if ( Math.abs(minutes*6 - angle) < 6 )
                {
                    arrow = "minute";
                }
            }


            e.stopPropagation();
            e.preventDefault();
        })


        .mousemove(function(e)
        {
            if ( !moving ) return;

            /// вычисляем локальные координаты мыши относительно центра циферблата
            var pos = {x: e.pageX - shift_pos.x, y: e.pageY - shift_pos.y};

            // определяем квадрат расстояния (не будем вычислять корень, в целях оптимизации)
            // и приостанавливаем вращение стрелки, если курсор мыши слишком близко к центру циферблата
            var distance = pos.x * pos.x + pos.y * pos.y;
            if ( distance < MIN_DISTANCE ) return;

            // определяем угол, между центром циферблата и указателем мыши
            // тем самым мы определяем время
            var angle = getAngle(pos.x, pos.y), h, m;


            // Режим задания времени в "быстром" режиме
            if ( arrow == 'both' )
            {
                h = parseInt(angle / 30);
                m = parseInt((angle - h * 30) * 2);

                // поправочка, чтобы минутная стрелка двигалась с интервалом 5 минут
                m = Math.floor(m / 5) * 5;

                hours = h; minutes = m;
            }

            if ( arrow == 'minute' )
            {
                h = hours;
                m = parseInt(angle/6);

                // контролируем правильный ход часовой стрелки, когда минутная делает полный оборот
                if ( Math.abs(m - minutes) > 50 )
                {
                    if ( m < 10 ) {
                        h++;
                        if (h > 12) h -= 12;
                    }
                    else
                    if ( m > 50 )
                    {
                        h--;
                        if (h < 0) h += 12;
                    }
                }

                hours = h; minutes = m;
            }

            if ( arrow == 'hour' )
            {
                hours = parseInt(angle / 30);
            }

            updateTimeElement();
            updateClockElement();

            e.stopPropagation();
            e.preventDefault();
        })


        .mouseup(function(e)
        {
            moving = false;

            e.stopPropagation();
            e.preventDefault();
        });




        /**
         * Обработка события переключения режима отображения часов (AM/PM)
         * ВНИМАНИЕ БАГ: при щелчке по переключателю АМ/РМ связанное поле теряет фокус ввода
         */
        clockui.find('.switch-button').click(function(e)
        {
            pm_time = !pm_time;

            updateTimeElement();
            updateClockElement();

            // возвращаем фокус ввода в текстовое поле если мы работаем не на сенсорном экране и без календаря
            if ( !(opt.touchscreen || input.data().hasDatepicker) ) input.trigger('focus');

            e.stopPropagation();
            e.preventDefault();
        });


        /**
         * Проверка нажатия кнопки мыши за пределами элемента
         */
        $(document).mousedown(function(e)
        {
            if ( clockui.css('display') != 'none' )
            {
                var target = $(e.target);
                if ( !(target.hasClass('time-picker') || target.hasClass('switch-button') || e.target == input[0] ) )
                {
                    hide();
                }
            }
        });











        // для каждого input в наборе. заданном вызовом $('input').timePicker()
        //
        return this.each(function()
        {
            var el = $(this);

            // пропускаем элементы, которые мы уже обрабатывали ранее
            if ( el.data()['timePicked'] ) return;

            // проверим, связано ли поле с календарем jQueryUI
            var datePicker = el.hasClass('hasDatepicker');

            if ( datePicker )
            {
                el.data().hasDatepicker = true;
            }

            // подавляем возможность редактирования текстового поля на сенсорных экранах
            // иначе будет всплывать встроенная клавиатура, закрывающая циферблат
            if ( opt.touchscreen ) el.attr('readonly', 'readonly');

            // парсим текстовое значение поля, чтобы записать время в его внутренние переменные
            if ( parseTime(el.val()) )
            {
                el.data().hours = hours;
                el.data().minutes = minutes;
                el.data().pm_time = pm_time;
                el.data().time = ((hours + pm_time?12:0)*60 + minutes)*60;
            }
            else
            {
                el.data().hours = opt.defaultHour;
                el.data().minutes = opt.defaultMin;
                el.data().pm_time = opt.PM;
                el.data().time = ((opt.defaultHour + opt.PM?12:0)*60 + opt.defaultMin)*60;
            }


            /**
             * обработка всплытия и сокрытия элемента "часы"
             */
            el.on("click focus time", function(e)
            {
                if ( showing ) return;

                // получим контекст элемента, для которого мы показываем себя "в данный момент"
                input = $(this);

                // если с полем связанн еще и календарь, то
                if ( input.data().hasDatepicker )
                {
                    // вначале, покажем его
                    if (e.type != 'time' ) return;

                    // затем, восстановим время из внутренних данных элемента
                    hours = input.data().hours || opt.defaultHour;
                    minutes = input.data().minutes || opt.defaultMin;
                    pm_time = input.data().pm_time != undefined ? input.data().pm_time : opt.PM;

                    updateTimeElement();
                }
                else // если с полем не связан календарь, то
                {
                    // прочитаем время, непосредственно из текстового поля
                    parseTime(input.val());
                }

                // найдем наилучшую позицию для вывода
                var pos = findBestPosition();

                clockui.css('left', pos.left  + 'px');
                clockui.css('top', pos.top + 'px');

                // устанавливаем время на часах
                if ( opt.touchscreen )
                {
                    animateArrow( $('.time-picker-hour'), hours * 30 + minutes/2, 0, true );
                    animateArrow( $('.time-picker-minute'), minutes * 6, 0, true );
                    var img = clockui.find('.switch-image').text( (pm_time) ? 'PM' : 'AM' );
                    if ( pm_time ) img.addClass('pm_time'); else img.removeClass('pm_time');
                }
                else
                {
                    // мгновенно поворачиваем стрелки
                    updateClockElement();
                }

                // можем показаться
                show();
            })

            .keyup(function(e)
            {
                // игнорируем вызов, если мы скрыты
                if ( !showing ) return;

                // выходим и закрываем себя, если пользователь нажал Enter
                // скрываем себя, если пользователь собрался набирать текст с клавиатуры
                // и нажал Esc, чтобы наш диалог ему не мешал
                if (e.keyCode == 13 || e.keyCode == 27) { hide(); return; }

                if ( parseTime( $(this).val() ) ) updateClockElement();
            })

            .keydown(function(e)
            {
                // игнорируем вызов, если мы скрыты
                if ( !showing ) return;

                if (e.keyCode == 9 && e.target == input[0]) { hide(); }
            })

            .blur(function()
            {
                if ( !showing && parseTime( input.val() ) ) updateTimeElement();
            });


            // связываем календарь datepicker с нашими часами timepicker по данному полю el
            if ( datePicker )
            {
                el.data().oldDatePickerHandler = el.datepicker('option', 'onClose');

                el.datepicker('option', 'onClose', function(text, picker)
                {
                    // если на событие onClose календаря был установлен пользовательский обработчик, вызовем его
                    var h = el.data().oldDatePickerHandler;
                    if ( h ) h.apply(el[0], [text, picker]);

                    // сообщаем себе, что календарь был закрыт, настал наш черед
                    el.trigger('time');
                });
            }

            el.data().timePicked = true;

        }); // конец цикла связывания элементов

    }; // end $.fn.colorPicker


})( jQuery );
