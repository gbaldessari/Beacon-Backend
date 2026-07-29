import 'reflect-metadata';
import { EmailModule } from '../email.module';
import { EmailService } from '../email.service';

describe('EmailModule', () => {
  it('declara providers y exports esperados', () => {
    const providers = Reflect.getMetadata('providers', EmailModule);
    const exportsList = Reflect.getMetadata('exports', EmailModule);

    expect(providers).toEqual([EmailService]);
    expect(exportsList).toEqual([EmailService]);
  });
});
