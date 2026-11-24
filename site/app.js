// 1. SINGLETON — единый журнал действий

const Logger = (() => {
    let instance = null;

    class ActionLogger {
        constructor() {
            this.messages = [];
        }

        add(message) {
            const time = new Date().toLocaleTimeString("ru-RU");

            this.messages.unshift(`[${time}] ${message}`);

            if (this.messages.length > 30) {
                this.messages.pop();
            }
        }

        getMessages() {
            return [...this.messages];
        }
    }

    return {
        getInstance() {
            if (!instance) {
                instance = new ActionLogger();
            }

            return instance;
        }
    };
})();

const logger = Logger.getInstance();


// 2. OBSERVER — наблюдатель

class ObservableState {
    constructor(initialState) {
        this.state = initialState;
        this.listeners = [];
    }

    subscribe(listener) {
        this.listeners.push(listener);
    }

    setState(newState) {
        this.state = {
            ...this.state,
            ...newState
        };

        this.notify();
    }

    notify() {
        this.listeners.forEach(listener => {
            listener(this.state);
        });
    }

    getState() {
        return this.state;
    }
}

const state = new ObservableState({
    books: [],
    selectedBookId: null,
    views: 0,
    events: []
});

function addObserverEvent(message) {
    logger.add(message);

    const currentEvents = state.getState().events;

    state.setState({
        events: logger.getMessages()
    });
}


// ОТОБРАЖЕНИЕ ДАННЫХ OBSERVER

function renderBookList(currentState) {
    const container = document.getElementById("book-list");

    container.innerHTML = "";

    currentState.books.forEach(book => {
        const button = document.createElement("button");

        button.className = "book-button";

        if (book.id === currentState.selectedBookId) {
            button.classList.add("active");
        }

        button.textContent = book.title;

        // Обработчик изменяет состояние, но не обращается напрямую к другим блокам.
        button.addEventListener("click", () => {
            const current = state.getState();

            state.setState({
                selectedBookId: book.id,
                views: current.views + 1
            });

            addObserverEvent(`Выбрана книга: ${book.title}`);
        });

        container.appendChild(button);
    });
}

function renderSelectedBook(currentState) {
    const container = document.getElementById("selected-book");

    const book = currentState.books.find(
        item => item.id === currentState.selectedBookId
    );

    if (!book) {
        container.textContent = "Выберите книгу из списка.";
        return;
    }

    container.innerHTML = `
        <strong>${escapeHTML(book.title)}</strong>
        <p>Автор: ${escapeHTML(book.author)}</p>
        <p>Год: ${book.year}</p>
        <p>Рейтинг: ${book.rating}</p>
        <p>Жанр: ${escapeHTML(book.genre)}</p>
    `;
}

function renderViewCount(currentState) {
    document.getElementById("view-count").textContent =
        `Просмотров: ${currentState.views}`;
}

function renderObserverLog(currentState) {
    const container = document.getElementById("observer-log");

    container.textContent = currentState.events.join("\n");
}


// ПОДПИСКА НА ИЗМЕНЕНИЯ СОСТОЯНИЯ

// Каждый блок самостоятельно реагирует на изменение общего состояния.

state.subscribe(renderBookList);
state.subscribe(renderSelectedBook);
state.subscribe(renderViewCount);
state.subscribe(renderObserverLog);


// 3. STRATEGY — стратегия сортировки

// Каждая стратегия реализована отдельно.

const sortingStrategies = {
    title(books) {
        return [...books].sort((a, b) =>
            a.title.localeCompare(b.title, "ru")
        );
    },

    year(books) {
        return [...books].sort(
            (a, b) => b.year - a.year
        );
    },

    rating(books) {
        return [...books].sort(
            (a, b) => b.rating - a.rating
        );
    }
};

class BookSorter {
    constructor(strategy) {
        this.strategy = strategy;
    }

    setStrategy(strategy) {
        this.strategy = strategy;
    }

    sort(books) {
        return this.strategy(books);
    }
}

const sorter = new BookSorter(sortingStrategies.title);

function renderStrategyList() {
    const container = document.getElementById("strategy-list");

    const sortedBooks = sorter.sort(state.getState().books);

    container.innerHTML = "";

    sortedBooks.forEach(book => {
        const card = document.createElement("div");

        card.className = "book-card";

        card.innerHTML = `
            <strong>${escapeHTML(book.title)}</strong>
            <div>Автор: ${escapeHTML(book.author)}</div>
            <div>Год: ${book.year}</div>
            <div>Рейтинг: ${book.rating}</div>
            <div>Жанр: ${escapeHTML(book.genre)}</div>
        `;

        container.appendChild(card);
    });
}

document.getElementById("sort-strategy")
    .addEventListener("change", event => {

        const strategy = sortingStrategies[event.target.value];

        sorter.setStrategy(strategy);

        renderStrategyList();

        logger.add("Изменён способ сортировки книг");
        renderCommandLog();
    });


// 4. COMMAND — команда

class AddBookCommand {
    constructor(book) {
        this.book = book;
    }

    execute() {
        const books = [...state.getState().books];

        books.push(this.book);

        state.setState({ books });

        addObserverEvent(`Добавлена книга: ${this.book.title}`);
    }

    undo() {
        const books = state.getState().books.filter(
            book => book.id !== this.book.id
        );

        state.setState({
            books,
            selectedBookId:
                state.getState().selectedBookId === this.book.id
                    ? null
                    : state.getState().selectedBookId
        });

        addObserverEvent(`Отменено добавление: ${this.book.title}`);
    }
}

class DeleteBookCommand {
    constructor(book) {
        this.book = book;
        this.index = null;
        this.previousSelection = null;
    }

    execute() {
        const current = state.getState();

        this.index = current.books.findIndex(
            book => book.id === this.book.id
        );

        this.previousSelection = current.selectedBookId;

        const books = current.books.filter(
            book => book.id !== this.book.id
        );

        state.setState({
            books,
            selectedBookId:
                current.selectedBookId === this.book.id
                    ? null
                    : current.selectedBookId
        });

        addObserverEvent(`Удалена книга: ${this.book.title}`);
    }

    undo() {
        const books = [...state.getState().books];

        books.splice(this.index, 0, this.book);

        state.setState({
            books,
            selectedBookId: this.previousSelection
        });

        addObserverEvent(`Восстановлена книга: ${this.book.title}`);
    }
}

class CommandManager {
    constructor() {
        this.history = [];
    }

    execute(command) {
        command.execute();

        this.history.push(command);

        renderCommandLog();
    }

    undo() {
        if (this.history.length === 0) {
            alert("Нет действий для отмены.");
            return;
        }

        const command = this.history.pop();

        command.undo();

        renderCommandLog();
    }
}

const commandManager = new CommandManager();


// УПРАВЛЕНИЕ КОМАНДАМИ

document.getElementById("add-book")
    .addEventListener("click", () => {

        const title = document.getElementById("new-title").value.trim();
        const author = document.getElementById("new-author").value.trim();

        if (!title || !author) {
            alert("Введите название книги и автора.");
            return;
        }

        const book = {
            id: Date.now(),
            title,
            author,
            year: new Date().getFullYear(),
            rating: 0,
            genre: "не указан"
        };

        commandManager.execute(new AddBookCommand(book));

        document.getElementById("new-title").value = "";
        document.getElementById("new-author").value = "";
    });


document.getElementById("delete-book")
    .addEventListener("click", () => {

        const current = state.getState();

        const book = current.books.find(
            item => item.id === current.selectedBookId
        );

        if (!book) {
            alert("Сначала выберите книгу в списке.");
            return;
        }

        commandManager.execute(new DeleteBookCommand(book));
    });


document.getElementById("undo-command")
    .addEventListener("click", () => {
        commandManager.undo();
    });

function renderCommandLog() {
    const container = document.getElementById("command-log");

    if (commandManager.history.length === 0) {
        container.textContent = "Выполненных команд нет.";
        return;
    }

    container.innerHTML = commandManager.history
        .map((command, index) => {
            return `${index + 1}. ${escapeHTML(command.book.title)}`;
        })
        .join("<br>");
}



// ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ

function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}


// ПРОВЕРКА SINGLETON

document.getElementById("singleton-check")
    .addEventListener("click", () => {

        const firstInstance = Logger.getInstance();
        const secondInstance = Logger.getInstance();

        const isSame = firstInstance === secondInstance;

        document.getElementById("singleton-result").textContent =
            `Первый экземпляр === Второй экземпляр: ${isSame}.
             Всего записей в общем журнале: ${firstInstance.messages.length}.`;

        logger.add("Выполнена проверка Singleton");

        renderObserverLog(state.getState());
    });


// ЗАГРУЗКА ДАННЫХ ИЗ JSON

async function initialize() {
    const status = document.getElementById("load-status");

    try {
        const response = await fetch("data.json");

        if (!response.ok) {
            throw new Error(`Ошибка HTTP: ${response.status}`);
        }

        const books = await response.json();

        state.setState({
            books,
            selectedBookId: null,
            views: 0,
            events: []
        });

        renderStrategyList();

        status.textContent =
            `Данные загружены успешно. Количество книг: ${books.length}`;

        logger.add("Библиотека успешно загружена");

        state.setState({
            events: logger.getMessages()
        });

    } catch (error) {
        status.textContent =
            `Ошибка загрузки данных: ${error.message}`;

        logger.add(`Ошибка загрузки: ${error.message}`);

        state.setState({
            events: logger.getMessages()
        });

        console.error(error);
    }
}

// ЗАПУСК ПРИЛОЖЕНИЯ

initialize();
