// Base exception classes

export class AmuleException extends Error {
	constructor(
		message: string,
		public cause?: Error
	) {
		super(message);
		this.name = 'AmuleException';
	}
}

export class InvalidECException extends AmuleException {
	constructor(message: string, cause?: Error) {
		super(message, cause);
		this.name = 'InvalidECException';
	}
}

export class CommunicationException extends AmuleException {
	constructor(message: string, cause?: Error) {
		super(message, cause);
		this.name = 'CommunicationException';
	}
}

export class ServerException extends AmuleException {
	constructor(message: string, cause?: Error) {
		super(message, cause);
		this.name = 'ServerException';
	}
}
