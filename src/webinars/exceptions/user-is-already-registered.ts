export class UserIsAlreadyRegisteredException extends Error {
    constructor() {
      super('User is already registered');
      this.name = 'UserIsAlreadyRegisteredException';
    }
  }