// BoardSDK.js
// Minimal local stand-in for the monday.com board API — no network calls, no board data.
// Always reports "no items", so callers fall back to their own local/sample data.

class ItemsQuery {
  withColumns() {
    return this;
  }
  async execute() {
    return { items: [] };
  }
}

class ItemQuery {
  withColumns() {
    return this;
  }
  update() {
    return this;
  }
  async execute() {
    return null;
  }
}

export class PrintTestBoard {
  constructor(boardId) {
    this.boardId = boardId;
  }
  items() {
    return new ItemsQuery();
  }
  item(itemId) {
    return new ItemQuery(itemId);
  }
}
