export class EmailNotFoundException extends Error {
    constructor() {
      super('Email not found');
      this.name = 'EmailNotFoundException';
    }
  }