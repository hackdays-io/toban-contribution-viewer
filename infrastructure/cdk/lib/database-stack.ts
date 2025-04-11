import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';

export class DatabaseStack extends cdk.Stack {
  public readonly databaseSecretArn: string;
  public readonly databaseInstance: rds.DatabaseInstance;
  public readonly vpc: ec2.Vpc;
  public readonly dbSecurityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create VPC
    this.vpc = new ec2.Vpc(this, 'TobanCVVPC', {
      maxAzs: 2,
      natGateways: 1
    });

    // Create security group for database
    this.dbSecurityGroup = new ec2.SecurityGroup(this, 'DatabaseSecurityGroup', {
      vpc: this.vpc,
      description: 'Security group for RDS PostgreSQL instance'
    });

    // Create database credentials secret
    const databaseCredentialsSecret = new secretsmanager.Secret(this, 'DBCredentialsSecret', {
      secretName: 'tobancv/database-credentials',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          username: 'toban_admin',
        }),
        excludePunctuation: true,
        includeSpace: false,
        generateStringKey: 'password',
      },
    });

    this.databaseSecretArn = databaseCredentialsSecret.secretArn;

    // Create RDS PostgreSQL instance
    this.databaseInstance = new rds.DatabaseInstance(this, 'Database', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_13,
      }),
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.BURSTABLE3,
        ec2.InstanceSize.MICRO
      ),
      credentials: rds.Credentials.fromSecret(databaseCredentialsSecret),
      vpc: this.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [this.dbSecurityGroup],
      multiAz: false,
      allocatedStorage: 20,
      maxAllocatedStorage: 100,
      allowMajorVersionUpgrade: false,
      autoMinorVersionUpgrade: true,
      backupRetention: cdk.Duration.days(7),
      deleteAutomatedBackups: true,
      deletionProtection: false,
      databaseName: 'tobancv',
      publiclyAccessible: false,
    });

    // Output the database endpoint
    new cdk.CfnOutput(this, 'DBEndpoint', {
      value: this.databaseInstance.dbInstanceEndpointAddress,
      description: 'Database endpoint',
      exportName: 'TobanCVDBEndpoint',
    });

    // Output the database secret ARN
    new cdk.CfnOutput(this, 'DBSecretArn', {
      value: databaseCredentialsSecret.secretArn,
      description: 'Database credentials secret ARN',
      exportName: 'TobanCVDBSecretArn',
    });
  }
}
