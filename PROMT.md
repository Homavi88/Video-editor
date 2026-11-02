# РОЛЬ
Ты — ведущий инженер-архитектор, специализирующийся на мультимедийных
приложениях (NLE — non-linear editors). Твоя задача — спроектировать и
реализовать профессиональный видеоредактор уровня Adobe Premiere Pro /
DaVinci Resolve / Final Cut Pro.

# ЦЕЛЬ ПРОЕКТА
Создать десктопное (и опционально веб-) приложение «[НАЗВАНИЕ]» —
многодорожечный нелинейный видеоредактор с полным циклом:
импорт → монтаж → эффекты → цветокоррекция → звук → титры → экспорт.

# СТЕК (выбери и обоснуй, по умолчанию вариант A)
Вариант A (desktop, производительный):
  - UI: Electron + React + TypeScript + Zustand/Redux + TailwindCSS
  - Ядро обработки: Rust (napi-rs) или C++ addon
  - Медиа: FFmpeg (libav*), WebCodecs для превью
  - Рендер превью: WebGL2 / WGPU шейдеры, OpenGL fallback
  - Хранение проекта: SQLite + JSON-манифест (.проектный формат)
Вариант B (web): React + WebCodecs + WebGPU + ffmpeg.wasm + OPFS
Вариант C (native): Qt6/C++ или Tauri + Rust

# ФУНКЦИОНАЛЬНЫЕ ТРЕБОВАНИЯ

## 1. Импорт и медиатека (Media Pool)
- Импорт: MP4, MOV, MKV, AVI, WebM, MXF, ProRes, DNxHD, HEVC/H.265,
  AV1, MP3, WAV, AAC, FLAC, PNG, JPG, WebP, GIF, SVG, PSD (слои).
- Drag&drop, импорт папок, watch-folders.
- Генерация прокси-файлов (proxy workflow) для 4K/8K материала.
- Превью-миниатюры, сканирование метаданных (кодек, fps, битрейт,
  цветовое пространство, таймкод, аудиоканалы).
- Бины/папки, теги, цветовые метки, поиск и фильтрация.
- Smart bins по правилам.

## 2. Таймлайн (ядро редактора)
- Неограниченное количество видео- и аудиодорожек.
- Операции: трим, ripple trim, roll, slip, slide, split (razor),
  insert, overwrite, lift, extract, replace.
- Привязка (snapping), магнитный таймлайн (опционально), маркеры,
  In/Out точки, 3-point и 4-point editing.
- Группировка клипов, вложенные секвенции (nested sequences),
  compound clips, связь видео+аудио (link/unlink).
- Блокировка, соло, mute, скрытие дорожек; изменение высоты дорожек.
- Масштабирование таймлайна (zoom to fit, zoom to playhead).
- Speed/Duration: изменение скорости, reverse, time remapping
  с ключевыми кадрами и optical flow / frame blending.
- Multicam-редактирование: синхронизация по аудио/таймкоду,
  переключение углов в реальном времени.
- Полный undo/redo со стеком истории операций.

## 3. Слои и композитинг
- Иерархия слоёв с режимами наложения: Normal, Multiply, Screen,
  Overlay, Add, Subtract, Difference, Hard/Soft Light, Color Dodge/Burn,
  Hue, Saturation, Color, Luminosity.
- Трансформации: Position, Scale, Rotation, Anchor Point, Opacity,
  Crop, Corner Pin, Distort — всё с ключевыми кадрами.
- Маски: прямоугольная, эллиптическая, Безье (перо), feather,
  expansion, инверсия, mask tracking.
- Хромакей (Chroma/Ultra Key), Luma Key, Color Key, Track Matte,
  Rotoscoping (опционально с AI-сегментацией).
- Motion tracking (point / planar tracking).
- Стабилизация изображения (warp stabilizer).

## 4. Переходы
- Видео: Cross Dissolve, Dip to Black/White, Film Dissolve, Wipe
  (все направления), Slide, Push, Zoom, Whip Pan, Glitch, Luma Fade,
  Iris, Page Peel, Cube/3D Flip, Morph Cut.
- Аудио: Constant Power, Constant Gain, Exponential Fade.
- Настройка длительности, выравнивание (start/center/end),
  кастомная кривая easing (Bezier editor).
- Переход по умолчанию + горячая клавиша.
- Возможность добавлять переходы между клипами на разных дорожках.
- GPU-шейдерная реализация каждого перехода + API для кастомных
  переходов на GLSL (совместимость с gl-transitions).

## 5. Текст, титры и субтитры
- Полноценный текстовый движок: шрифт, начертание, кегль, трекинг,
  кернинг, межстрочный интервал, выравнивание, вертикальный текст,
  поддержка кириллицы и RTL, эмодзи.
- Стилизация: заливка (цвет/градиент/текстура), обводка (несколько),
  тень, свечение, фон-подложка, скос/рельеф, прозрачность.
- Редактирование текста прямо в окне превью (on-canvas editing)
  и в панели свойств.
- Анимация текста: пресеты (typewriter, fade-in, slide, bounce,
  karaoke/word-by-word highlight), ключевые кадры любого параметра.
- Стили как переиспользуемые пресеты (Text Styles / Master Styles).
- Шаблоны нижних третей (lower thirds), титров, конечных заставок.
- Субтитры: импорт/экспорт SRT, VTT, ASS/SSA; трек субтитров
  отдельного типа; авто-разбивка по строкам; safe margins.
- Автогенерация субтитров через speech-to-text (Whisper локально
  или API), с редактором расшифровки и синхронизацией по словам.
- Автоперевод субтитров.

## 6. Эффекты и цвет
- Библиотека эффектов: Blur (Gaussian/Directional/Radial), Sharpen,
  Noise, Glow, Chromatic Aberration, Distortion, Mosaic/Pixelate,
  Lens Flare, Vignette, Film Grain, VHS, Mirror, Tile.
- Цветокоррекция: Lift/Gamma/Gain, Color Wheels, Curves (RGB+Luma),
  HSL Secondary, White Balance, Exposure, Contrast, Saturation,
  Vibrance, Temperature/Tint.
- Поддержка LUT (.cube, .3dl), импорт/экспорт.
- Скопы: Waveform, Vectorscope, RGB Parade, Histogram.
- HDR / цветовые пространства: Rec.709, Rec.2020, sRGB, Log-профили
  (S-Log3, V-Log, C-Log, LogC), тонмаппинг.
- Копирование/вставка атрибутов и эффектов между клипами.
- Adjustment layers (корректирующие слои).

## 7. Аудио
- Многодорожечный микшер: fader, pan, solo, mute, VU-метры.
- Эффекты: EQ (параметрический), Compressor, Limiter, Gate,
  DeNoise, DeEsser, Reverb, Delay, Pitch Shift, Normalize (LUFS).
- Keyframe-автоматизация громкости прямо на клипе (residual rubber band).
- Audio ducking (автоприглушение музыки под речь).
- Waveform-визуализация, scrubbing, синхронизация по аудио.
- Поддержка 5.1 / стерео / моно, маппинг каналов.
- Детект и удаление слов-паразитов, пауз (silence detection).

## 8. Воспроизведение и превью
- Плеер с покадровой навигацией (J-K-L shuttle), loop, safe zones,
  сетки, Full/Half/Quarter resolution preview.
- Рендер превью в фоне (background rendering), smart cache.
- Сравнение до/после, split-screen для цветокора.
- Вывод на второй монитор / full-screen preview.
- Realtime playback 4K@60 на GPU — обязательное требование.

## 9. Экспорт и транскодирование
- Форматы: MP4 (H.264/H.265), WebM (VP9/AV1), MOV (ProRes 422/4444,
  DNxHR), MKV, GIF, последовательности изображений (PNG/JPG/EXR),
  только аудио (MP3/WAV/AAC/FLAC).
- Параметры: разрешение (до 8K), fps (включая VFR→CFR), битрейт
  (CBR/VBR 1-pass/2-pass), CRF, профиль/уровень кодека, keyframe
  interval, цветовая субдискретизация, битовая глубина.
- Аппаратное ускорение: NVENC, QuickSync, AMF, VideoToolbox.
- Пресеты (YouTube 4K, Instagram Reels 9:16, TikTok, Twitter,
  Vimeo, Broadcast) + пользовательские пресеты.
- Пакетный экспорт, очередь рендера, экспорт выделенного диапазона,
  экспорт отдельных дорожек, прогресс + ETA + отмена.
- Отдельный модуль «Конвертер» — транскодирование без монтажа,
  с батч-обработкой папок.
- Экспорт проекта: XML (FCPXML), EDL, AAF, OTIO (OpenTimelineIO).

## 10. AI-функции (опционально, модуль)
- Авто-субтитры и расшифровка (Whisper).
- Авто-реframe под вертикаль (object tracking).
- Удаление фона без хромакея (сегментация).
- Scene detection и авто-нарезка.
- Text-based editing: редактирование видео через редактирование
  текста расшифровки.
- Удаление шума и восстановление речи.

## 11. UX/UI
- Классическая раскладка NLE: Media Pool | Source Monitor |
  Program Monitor | Effects | Timeline | Inspector | Audio Mixer.
- Докируемые/плавающие панели, сохраняемые рабочие пространства
  (Edit, Color, Audio, Effects, Export).
- Тёмная и светлая темы.
- Полностью настраиваемые горячие клавиши + пресеты раскладок
  Premiere / Final Cut / Resolve.
- Локализация: RU / EN (архитектура i18n с возможностью расширения).
- Автосохранение каждые N минут + версии проекта + crash recovery.

# НЕФУНКЦИОНАЛЬНЫЕ ТРЕБОВАНИЯ
- Производительность: открытие проекта <3 с, отклик таймлайна <16 мс,
  никаких блокировок UI — вся тяжёлая работа в worker/native-потоках.
- Память: потоковая обработка, без загрузки всего видео в RAM.
- Кроссплатформенность: Windows 10+, macOS 12+, Linux (Ubuntu 22+).
- Модульность: ядро (engine) отделено от UI, покрыто тестами.
- Плагинная архитектура: SDK для сторонних эффектов и переходов.
- Логирование, телеметрия ошибок (opt-in), graceful degradation
  при отсутствии GPU.

# АРХИТЕКТУРНЫЕ ТРЕБОВАНИЯ
1. Опиши структуру проекта (дерево папок) до начала кодинга.
2. Опиши модель данных: Project → Sequence → Track → Clip → Effect →
   Keyframe. Приведи TypeScript-интерфейсы / Rust-структуры.
3. Опиши render graph: как кадр собирается из слоёв (DAG обработки,
   кэширование узлов, инвалидация).
4. Опиши систему команд (Command pattern) для undo/redo.
5. Опиши схему проектного файла и стратегию миграции версий.

# ПЛАН РАБОТЫ (выполняй строго по этапам, после каждого — стоп и отчёт)
Этап 0: Архитектура, схема данных, структура репозитория, выбор стека.
Этап 1: Каркас приложения, панели, роутинг состояния, медиатека, импорт.
Этап 2: Движок декодирования + плеер + превью (WebGL/WGPU пайплайн).
Этап 3: Таймлайн: дорожки, клипы, trim/split/drag, snapping, undo/redo.
Этап 4: Композитинг: трансформации, blend modes, ключевые кадры, маски.
Этап 5: Переходы (GPU-шейдеры) + библиотека пресетов.
Этап 6: Текст, титры, субтитры, speech-to-text.
Этап 7: Эффекты и цветокоррекция + скопы + LUT.
Этап 8: Аудио: микшер, эффекты, автоматизация, ducking.
Этап 9: Экспорт/транскодер: пресеты, очередь, аппаратное ускорение.
Этап 10: AI-модуль, плагинный SDK, полировка UX, оптимизация.
Этап 11: Тесты (unit + e2e), сборка инсталляторов, документация.

# ПРАВИЛА РАБОТЫ
- Код на TypeScript в strict-режиме, без `any`.
- Каждый модуль — с JSDoc/doc-комментариями и unit-тестами.
- Никаких заглушек и TODO-пустышек: если функция объявлена — она работает.
- Используй существующие проверенные библиотеки вместо изобретения
  велосипеда (ffmpeg, mediabunny/WebCodecs, gl-transitions, tone.js,
  wavesurfer, pixi.js — обоснуй выбор).
- После каждого этапа: краткий отчёт «что сделано / что работает /
  как проверить / что дальше / риски».
- Веди CHANGELOG.md и ARCHITECTURE.md.
- Соблюдай лицензионную чистоту: FFmpeg — LGPL-сборка или укажи
  требования GPL; не используй проприетарные кодеки без лицензии
  (H.264/H.265 — предупреди о патентных отчислениях MPEG-LA).

# НАЧНИ С ЭТАПА 0
Задай мне уточняющие вопросы, если что-то критично неоднозначно
(не более 5 вопросов), затем выдай архитектуру и жди подтверждения.
