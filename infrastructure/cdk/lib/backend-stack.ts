import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as elasticbeanstalk from 'aws-cdk-lib/aws-elasticbeanstalk';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';

interface BackendStackProps extends cdk.StackProps {
  databaseSecretArn: string;
  databaseInstance: rds.DatabaseInstance;
  vpc: ec2.Vpc;
  dbSecurityGroup: ec2.SecurityGroup;
}

export class BackendStack extends cdk.Stack {
  public readonly apiUrl: string;

  constructor(scope: Construct, id: string, props: BackendStackProps) {
    super(scope, id, props);

    // Use the VPC from the database stack
    const vpc = props.vpc;

    // Create a security group for the Elastic Beanstalk environment
    const ebSecurityGroup = new ec2.SecurityGroup(this, 'EBSecurityGroup', {
      vpc,
      description: 'Security group for Elastic Beanstalk environment'
    });

    // We'll output the security group ID for external management
    new cdk.CfnOutput(this, 'EBSecurityGroupId', {
      value: ebSecurityGroup.securityGroupId,
      description: 'Security group ID for Elastic Beanstalk environment',
      exportName: 'TobanEBSecurityGroupId',
    });

    // Create an S3 bucket for application versions
    const appVersionBucket = new s3.Bucket(this, 'AppVersionBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      versioned: true,
    });

    // Create an IAM role for the Elastic Beanstalk instance profile
    const ebInstanceRole = new iam.Role(this, 'EBInstanceRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
    });

    // Add managed policies to the instance role
    ebInstanceRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonS3ReadOnlyAccess')
    );
    ebInstanceRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('AWSElasticBeanstalkWebTier')
    );

    // Add permissions to access the database secret
    ebInstanceRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['secretsmanager:GetSecretValue'],
        resources: [props.databaseSecretArn],
      })
    );

    // Create the instance profile
    const ebInstanceProfile = new iam.CfnInstanceProfile(this, 'EBInstanceProfile', {
      roles: [ebInstanceRole.roleName],
    });

    // Create the Elastic Beanstalk application
    const ebApp = new elasticbeanstalk.CfnApplication(this, 'Application', {
      applicationName: 'TobanContributionViewer',
      description: 'Toban Contribution Viewer Backend',
    });

    // Create the Elastic Beanstalk environment
    const ebEnv = new elasticbeanstalk.CfnEnvironment(this, 'Environment', {
      environmentName: 'TobanContributionViewer-' + (process.env.ENVIRONMENT || 'dev'),
      applicationName: ebApp.applicationName as string,
      solutionStackName: '64bit Amazon Linux 2023 v4.0.6 running Python 3.11',
      optionSettings: [
        // VPC Configuration
        {
          namespace: 'aws:ec2:vpc',
          optionName: 'VPCId',
          value: vpc.vpcId,
        },
        {
          namespace: 'aws:ec2:vpc',
          optionName: 'Subnets',
          value: vpc.privateSubnets.map(subnet => subnet.subnetId).join(','),
        },
        {
          namespace: 'aws:ec2:vpc',
          optionName: 'ELBSubnets',
          value: vpc.publicSubnets.map(subnet => subnet.subnetId).join(','),
        },
        {
          namespace: 'aws:ec2:vpc',
          optionName: 'AssociatePublicIpAddress',
          value: 'false',
        },
        // Environment Configuration
        {
          namespace: 'aws:elasticbeanstalk:environment',
          optionName: 'EnvironmentType',
          value: 'LoadBalanced',
        },
        {
          namespace: 'aws:elasticbeanstalk:environment',
          optionName: 'LoadBalancerType',
          value: 'application',
        },
        {
          namespace: 'aws:elasticbeanstalk:environment',
          optionName: 'ServiceRole',
          value: 'aws-elasticbeanstalk-service-role',
        },
        // Instance Configuration
        {
          namespace: 'aws:autoscaling:launchconfiguration',
          optionName: 'IamInstanceProfile',
          value: ebInstanceProfile.ref,
        },
        {
          namespace: 'aws:autoscaling:launchconfiguration',
          optionName: 'SecurityGroups',
          value: ebSecurityGroup.securityGroupId,
        },
        {
          namespace: 'aws:autoscaling:launchconfiguration',
          optionName: 'InstanceType',
          value: 't3.small',
        },
        // Application Environment Variables
        {
          namespace: 'aws:elasticbeanstalk:application:environment',
          optionName: 'ENVIRONMENT',
          value: process.env.ENVIRONMENT || 'dev',
        },
        {
          namespace: 'aws:elasticbeanstalk:application:environment',
          optionName: 'DATABASE_SECRET_ARN',
          value: props.databaseSecretArn,
        },
        {
          namespace: 'aws:elasticbeanstalk:application:environment',
          optionName: 'DATABASE_HOST',
          value: props.databaseInstance.dbInstanceEndpointAddress,
        },
        // Application Deployment
        {
          namespace: 'aws:elasticbeanstalk:command',
          optionName: 'DeploymentPolicy',
          value: 'Rolling',
        },
        {
          namespace: 'aws:elasticbeanstalk:command',
          optionName: 'BatchSizeType',
          value: 'Percentage',
        },
        {
          namespace: 'aws:elasticbeanstalk:command',
          optionName: 'BatchSize',
          value: '25',
        },
        // Health check
        {
          namespace: 'aws:elasticbeanstalk:environment:process:default',
          optionName: 'HealthCheckPath',
          value: '/health',
        },
        // Auto Scaling
        {
          namespace: 'aws:autoscaling:asg',
          optionName: 'MinSize',
          value: '1',
        },
        {
          namespace: 'aws:autoscaling:asg',
          optionName: 'MaxSize',
          value: '3',
        },
        // Enhanced health monitoring
        {
          namespace: 'aws:elasticbeanstalk:healthreporting:system',
          optionName: 'SystemType',
          value: 'enhanced',
        },
      ],
    });

    // Make sure the environment is created after the application
    ebEnv.addDependency(ebApp);

    // Set the API URL output
    this.apiUrl = `https://${ebEnv.attrEndpointUrl}`;

    // Output the Elastic Beanstalk environment URL
    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: this.apiUrl,
      description: 'API endpoint URL',
      exportName: 'TobanApiEndpoint',
    });

    // Output the Elastic Beanstalk environment name for CI/CD integration
    new cdk.CfnOutput(this, 'EnvironmentName', {
      value: ebEnv.environmentName as string,
      description: 'Elastic Beanstalk environment name',
      exportName: 'TobanEBEnvironmentName',
    });
  }
}